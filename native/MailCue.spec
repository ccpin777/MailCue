# PyInstaller spec for MailCue's menu bar app. It follows Coding Deck's
# PySide6/onedir bundle approach and does not invoke Apple's Swift compiler.
from pathlib import Path
import json

NATIVE_DIR = Path(SPECPATH)
PROJECT_DIR = NATIVE_DIR.parent
APP_VERSION = json.loads((PROJECT_DIR / "package.json").read_text(encoding="utf-8"))["version"]

a = Analysis(
    [str(NATIVE_DIR / "mailcue_menubar.py")],
    pathex=[str(NATIVE_DIR)],
    datas=[
        (str(PROJECT_DIR / "bridge" / "server.mjs"), "bridge"),
        (str(PROJECT_DIR / "taskpane.html"), "."),
        (str(PROJECT_DIR / "src" / "taskpane.js"), "src"),
        (str(PROJECT_DIR / "src" / "taskpane.css"), "src"),
        (str(PROJECT_DIR / "assets" / "ai_discuss_icon_thin.svg"), "assets"),
        (str(PROJECT_DIR / "assets" / "settings.svg"), "assets"),
        (str(PROJECT_DIR / "assets" / "connection-states-preview.html"), "assets"),
        (str(PROJECT_DIR / "assets" / "icon-16.png"), "assets"),
        (str(PROJECT_DIR / "assets" / "icon-20.png"), "assets"),
        (str(PROJECT_DIR / "assets" / "icon-24.png"), "assets"),
        (str(PROJECT_DIR / "assets" / "icon-32.png"), "assets"),
        (str(PROJECT_DIR / "assets" / "icon-40.png"), "assets"),
        (str(PROJECT_DIR / "assets" / "icon-48.png"), "assets"),
        (str(PROJECT_DIR / "assets" / "icon-64.png"), "assets"),
        (str(PROJECT_DIR / "assets" / "icon-80.png"), "assets"),
    ],
    hiddenimports=["PySide6.QtSvg"],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter", "PySide6.QtWebEngine", "PySide6.QtWebEngineCore",
        "PySide6.QtWebEngineWidgets", "PySide6.QtMultimedia",
        "PySide6.QtMultimediaWidgets", "PySide6.Qt3DCore",
        "PySide6.Qt3DRender", "PySide6.Qt3DLogic", "PySide6.Qt3DAnimation",
        "PySide6.Qt3DExtras", "PySide6.Qt3DInput", "PySide6.QtCharts",
        "PySide6.QtDataVisualization", "PySide6.QtQuick", "PySide6.QtQuickWidgets",
        "PySide6.QtQml", "PySide6.QtBluetooth", "PySide6.QtNfc",
        "PySide6.QtSerialPort", "PySide6.QtSql", "PySide6.QtPdf",
        "PySide6.QtPdfWidgets", "PySide6.QtTest",
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, [], exclude_binaries=True, name="MailCue",
    debug=False, bootloader_ignore_signals=False, strip=False, upx=False,
    console=False,
)
coll = COLLECT(
    exe, a.binaries, a.zipfiles, a.datas, strip=False, upx=False, name="MailCue",
)
app = BUNDLE(
    coll,
    name="MailCue.app",
    bundle_identifier="com.mailcue.personal",
    info_plist={
        "CFBundleName": "MailCue",
        "CFBundleDisplayName": "MailCue",
        "CFBundleShortVersionString": APP_VERSION,
        "CFBundleVersion": APP_VERSION,
        "LSUIElement": True,
        "NSHighResolutionCapable": True,
        "NSPrincipalClass": "NSApplication",
    },
)
