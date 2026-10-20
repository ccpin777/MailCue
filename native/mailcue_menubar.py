#!/usr/bin/env python3
"""MailCue menu bar controller, built with the same PySide6 stack as Coding Deck."""

from __future__ import annotations

import os
import plistlib
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PySide6.QtCore import QByteArray, QProcess, QRectF, QTimer, Qt
from PySide6.QtGui import QAction, QIcon, QPainter, QPixmap
from PySide6.QtSvg import QSvgRenderer
from PySide6.QtWidgets import QApplication, QMenu, QMessageBox, QSystemTrayIcon


APP_NAME = "MailCue"
APP_ID = "com.mailcue.personal"
HOME = Path.home()
SUPPORT_DIR = HOME / "Library/Application Support/MailCue"
LOGIN_ITEM = HOME / "Library/LaunchAgents" / f"{APP_ID}.plist"
LOG_FILE = HOME / "Library/Logs/MailCue.log"


def resource_candidates(relative: str) -> list[Path]:
    if getattr(sys, "frozen", False):
        meipass = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)).resolve()
        executable_dir = Path(sys.executable).resolve().parent
        contents_dir = meipass.parent if meipass.parent.name == "Contents" else executable_dir.parent
        bases = [meipass, contents_dir / "Resources", executable_dir, contents_dir / "Frameworks"]
    else:
        # The source file lives in native/, while app resources live beside it
        # in the MailCue project root.
        bases = [Path(__file__).resolve().parent.parent]
    return list(dict.fromkeys(base / relative for base in bases))


def resource_path(relative: str) -> Path:
    candidates = resource_candidates(relative)
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return candidates[0]


def node_candidates() -> list[Path]:
    candidates = [
        Path("/opt/homebrew/bin/node"),
        Path("/usr/local/bin/node"),
        HOME / ".volta/bin/node",
        HOME / ".asdf/shims/node",
        HOME / ".local/share/mise/shims/node",
    ]
    for root, suffix in (
        (HOME / ".nvm/versions/node", "bin/node"),
        (HOME / ".fnm/node-versions", "installation/bin/node"),
        (HOME / ".local/share/mise/installs/node", "bin/node"),
    ):
        if root.is_dir():
            candidates.extend(sorted(root.glob("*/" + suffix), reverse=True))

    found = shutil.which("node")
    if found:
        candidates.append(Path(found))
    return candidates


def login_item_enabled() -> bool:
    return LOGIN_ITEM.exists()


class MailCueMenu:
    def __init__(self, app: QApplication) -> None:
        self.app = app
        # Ensure every normal Qt shutdown path also closes the Bridge child.
        self.app.aboutToQuit.connect(self.stop)
        self.process: subprocess.Popen | None = None
        self.process_log = None
        self.start_log_offset: int | None = None
        self.start_requested_at: float | None = None
        self.node_search_active = False
        self.node_candidate_active = False
        self.node_candidates: list[Path] = []
        self.node_candidate_index = 0
        self.node_candidate: Path | None = None
        self.server_path: Path | None = None
        self.node_process = QProcess(self.app)
        self.node_process.finished.connect(self._node_check_finished)
        self.node_process.errorOccurred.connect(self._node_check_error)
        self.node_timeout = QTimer(self.app)
        self.node_timeout.setSingleShot(True)
        self.node_timeout.timeout.connect(self._node_check_timeout)
        self.process_timer = QTimer(self.app)
        self.process_timer.setInterval(500)
        self.process_timer.timeout.connect(self._check_process)
        self.icon = self._make_icon()
        self.tray = QSystemTrayIcon(self.icon, app)
        self.tray.setToolTip(APP_NAME)
        self.menu = QMenu()
        self.status = QAction("Status: Off", self.menu)
        self.status.setEnabled(False)
        self.menu.addAction(self.status)
        self.error_status = QAction("", self.menu)
        self.error_status.setEnabled(False)
        self.error_status.setVisible(False)
        self.menu.addAction(self.error_status)
        self.menu.addSeparator()
        self.toggle_action = QAction("Turn On", self.menu)
        self.toggle_action.triggered.connect(self.toggle)
        self.menu.addAction(self.toggle_action)
        self.login_action = QAction("Launch at Login", self.menu)
        self.login_action.setCheckable(True)
        self.login_action.setChecked(login_item_enabled())
        self.login_action.triggered.connect(self.set_login_item)
        self.menu.addAction(self.login_action)
        self.menu.addSeparator()
        quit_action = QAction("Quit MailCue", self.menu)
        quit_action.triggered.connect(self.quit)
        self.menu.addAction(quit_action)
        self.tray.setContextMenu(self.menu)
        self.tray.show()

        if login_item_enabled():
            self.start()

    @staticmethod
    def _make_icon() -> QIcon:
        svg = resource_path("assets/ai_discuss_icon_thin.svg")
        try:
            renderer = QSvgRenderer(QByteArray(svg.read_bytes()))
        except OSError:
            return QIcon()
        if not renderer.isValid():
            return QIcon()
        pixmap = QPixmap(48, 48)
        pixmap.setDevicePixelRatio(2)
        pixmap.fill(Qt.GlobalColor.transparent)
        painter = QPainter(pixmap)
        renderer.render(painter, QRectF(0, 0, 24, 24))
        painter.end()
        icon = QIcon(pixmap)
        icon.setIsMask(True)
        return icon

    def _set_on(self, on: bool) -> None:
        self.status.setText(f"Status: {'On' if on else 'Off'}")
        self.toggle_action.setText("Turn Off" if on else "Turn On")
        self.toggle_action.setEnabled(True)

    def toggle(self) -> None:
        if self.node_search_active:
            self.stop()
            return
        if self.process and self.process.poll() is None:
            self.stop()
        else:
            self.start()

    def start(self) -> None:
        if self.node_search_active:
            return
        if self.process is not None:
            if self.process.poll() is None:
                self._set_on(True)
                return
            self._close_process_stdin()
            self.process = None
            self._close_process_log()

        for name in ("localhost.pem", "localhost-key.pem"):
            if not (SUPPORT_DIR / "certs" / name).is_file():
                self._show_error("MailCue certificate is missing. Run certificate setup first.")
                return

        server = resource_path("bridge/server.mjs")
        if not server.is_file():
            checked_paths = "\n".join(str(path) for path in resource_candidates("bridge/server.mjs"))
            self._show_error(
                f"MailCue Bridge is missing. Checked these paths:\n{checked_paths}\nRebuild MailCue."
            )
            return
        self.server_path = server
        self.node_candidates = node_candidates()
        self.node_candidate_index = 0
        self.node_search_active = True
        self._clear_error()
        self.status.setText("Status: Checking Node.js…")
        self.toggle_action.setEnabled(False)
        self._try_next_node()

    def _try_next_node(self) -> None:
        while self.node_search_active and self.node_candidate_index < len(self.node_candidates):
            candidate = self.node_candidates[self.node_candidate_index]
            self.node_candidate_index += 1
            if not candidate.is_file() or not os.access(candidate, os.X_OK):
                continue
            self.node_candidate = candidate
            self.node_candidate_active = True
            self.node_process.start(str(candidate), ["--version"])
            self.node_timeout.start(4000)
            return
        if self.node_search_active:
            self.node_search_active = False
            self.node_candidate_active = False
            self._show_error("Node.js 22 or later was not found.")

    def _node_check_timeout(self) -> None:
        if self.node_candidate_active and self.node_process.state() != QProcess.ProcessState.NotRunning:
            self.node_process.kill()

    def _node_check_error(self, error) -> None:
        if error == QProcess.ProcessError.FailedToStart:
            self.node_timeout.stop()
            self.node_candidate_active = False
            self._try_next_node()

    def _node_check_finished(self, exit_code: int, _exit_status) -> None:
        if not self.node_candidate_active:
            return
        self.node_timeout.stop()
        self.node_candidate_active = False
        output = bytes(self.node_process.readAllStandardOutput()).decode("utf-8", errors="replace").strip()
        try:
            version = int(output.lstrip("v").split(".", 1)[0])
        except ValueError:
            version = 0
        if exit_code == 0 and version >= 22 and self.node_candidate is not None:
            self.node_search_active = False
            self._launch_bridge(self.node_candidate)
            return
        self._try_next_node()

    def _launch_bridge(self, node: Path) -> None:
        server = self.server_path
        if server is None:
            self._show_error("MailCue Bridge path was lost during startup.")
            return
        environment = os.environ.copy()
        environment["PATH"] = os.pathsep.join(
            [str(node.parent), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]
        )
        try:
            LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
            self.process_log = LOG_FILE.open("a", encoding="utf-8")
            self.process_log.write(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] Starting MailCue Bridge\n")
            self.process_log.flush()
            self.start_log_offset = self.process_log.tell()
            self.process = subprocess.Popen(
                [str(node), str(server)],
                cwd=str(server.parent.parent),
                env=environment,
                # The Bridge watches this pipe for EOF. If this controller is
                # quit or crashes, the OS closes it and the Bridge exits too.
                stdin=subprocess.PIPE,
                stdout=self.process_log,
                stderr=subprocess.STDOUT,
            )
            self._clear_error()
            self.status.setText("Status: Starting…")
            self.toggle_action.setEnabled(False)
            self.start_requested_at = time.monotonic()
            self.process_timer.start()
        except OSError as exc:
            self.process = None
            self.start_log_offset = None
            self._close_process_log()
            self._show_error(f"Could not start MailCue: {exc}")
            return

    def _check_process(self) -> None:
        if self.process is None:
            self.process_timer.stop()
            return
        if self.process.poll() is not None:
            self._close_process_stdin()
            details = self._last_log_line()
            self.process = None
            self.process_timer.stop()
            self.start_requested_at = None
            self.start_log_offset = None
            self._close_process_log()
            message = "MailCue stopped. Ports 1455 or 1456 may already be in use."
            if details:
                message = f"MailCue stopped: {details}"
            self._show_error(message)
            return

        if self.start_requested_at is not None:
            if self._bridge_ready():
                self.start_requested_at = None
                self._set_on(True)
                return
            if time.monotonic() - self.start_requested_at > 10:
                details = self._last_log_line()
                self.stop()
                message = "MailCue did not start listening on both required ports."
                if details:
                    message = f"MailCue did not start: {details}"
                self._show_error(message)

    def _bridge_ready(self) -> bool:
        if self.process is None or self.start_log_offset is None:
            return False
        try:
            with LOG_FILE.open("r", encoding="utf-8", errors="replace") as log:
                log.seek(self.start_log_offset)
                return f"MAILCUE_READY:{self.process.pid}" in log.read()
        except OSError:
            return False

    def stop(self) -> None:
        if self.node_search_active:
            self.node_search_active = False
            self.node_candidate_active = False
            self.node_timeout.stop()
            if self.node_process.state() != QProcess.ProcessState.NotRunning:
                self.node_process.kill()
                self.node_process.waitForFinished(1000)
        process = self.process
        if process is not None:
            self.process_timer.stop()
            self._close_process_stdin()
            if process.poll() is None:
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    try:
                        process.terminate()
                    except OSError:
                        pass
                    try:
                        process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=3)
        self.process = None
        self.process_timer.stop()
        self.start_requested_at = None
        self.start_log_offset = None
        self._close_process_log()
        self._set_on(False)

    def _close_process_stdin(self) -> None:
        if self.process is not None and self.process.stdin is not None:
            try:
                self.process.stdin.close()
            except OSError:
                pass

    def set_login_item(self, checked: bool) -> None:
        try:
            if checked:
                executable = Path(sys.executable).resolve()
                arguments = [str(executable)]
                if not getattr(sys, "frozen", False):
                    # When run from source, LaunchAgent must invoke the menu
                    # controller script as well as the Python interpreter.
                    arguments.append(str(Path(__file__).resolve()))
                plist = {
                    "Label": APP_ID,
                    "ProgramArguments": arguments,
                    "RunAtLoad": True,
                    "KeepAlive": False,
                }
                LOGIN_ITEM.parent.mkdir(parents=True, exist_ok=True)
                LOGIN_ITEM.write_bytes(plistlib.dumps(plist))
            else:
                self._launchctl("bootout", APP_ID)
                LOGIN_ITEM.unlink(missing_ok=True)
        except OSError as exc:
            self.login_action.setChecked(LOGIN_ITEM.exists())
            self._show_error(f"Could not update Launch at Login: {exc}")

    @staticmethod
    def _launchctl(action: str, label: str) -> None:
        if action == "bootout" and not LOGIN_ITEM.exists():
            return
        subprocess.run(
            ["launchctl", action, f"gui/{os.getuid()}/{label}"],
            check=False,
            capture_output=True,
            text=True,
        )

    def _show_error(self, message: str) -> None:
        self.status.setText("Status: Error")
        self.toggle_action.setText("Turn On")
        self.toggle_action.setEnabled(True)
        self.error_status.setText(message)
        self.error_status.setVisible(True)
        self.tray.showMessage(APP_NAME, message, QSystemTrayIcon.MessageIcon.Warning, 7000)

    def _clear_error(self) -> None:
        self.error_status.setVisible(False)
        self.error_status.setText("")

    def _last_log_line(self) -> str:
        try:
            with LOG_FILE.open("r", encoding="utf-8", errors="replace") as log:
                if self.start_log_offset is not None:
                    log.seek(self.start_log_offset)
                lines = log.read().splitlines()
            normal_lines = (
                "MailCue listening on ",
                "SIWC callback listening on ",
                "MAILCUE_READY:",
            )
            for line in reversed(lines):
                if line and not line.startswith(normal_lines):
                    return line[:180]
            return ""
        except OSError:
            return ""

    def _close_process_log(self) -> None:
        if self.process_log is not None:
            self.process_log.close()
            self.process_log = None

    def quit(self) -> None:
        self.stop()
        self.app.quit()


def main() -> int:
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    if not QSystemTrayIcon.isSystemTrayAvailable():
        QMessageBox.critical(None, APP_NAME, "The macOS menu bar is unavailable.")
        return 1
    # Keep the controller alive for the full Qt event loop. Its bound methods
    # back the tray menu actions, so a temporary instance would lose handlers.
    controller = MailCueMenu(app)
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
