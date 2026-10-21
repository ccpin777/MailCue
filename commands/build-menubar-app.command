#!/bin/zsh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_DIR="$(cd "$PROJECT_DIR/../.." && pwd)"
VENV="$WORKSPACE_DIR/venv"
PYTHON="$VENV/bin/python"
DIST_DIR="$PROJECT_DIR/dist"
LOG_DIR="$PROJECT_DIR/build-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/build-menubar-$(date +%Y%m%d-%H%M%S)-$$.log"
# Keep this attempt and the two most recent previous build logs (success or failure).
: >> "$LOG_FILE"
(
  retention_dir=$(dirname -- "$LOG_FILE")
  command ls -1t "$retention_dir"/build-*.log | while IFS= read -r older_log; do
    [ "$older_log" != "$LOG_FILE" ] || continue
    [ -f "$older_log" ] && [ ! -L "$older_log" ] || continue
    retained_logs=${retained_logs:-1}
    retained_logs=$((retained_logs + 1))
    if [ "$retained_logs" -gt 3 ]; then
      rm -f -- "$older_log" || printf 'Warning: could not remove old build log: %s\n' "$older_log" >&2
    fi
  done
) || printf 'Warning: build log retention could not be completed.\n' >&2
exec > >(tee -a "$LOG_FILE") 2>&1

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This build command must be run on macOS."
  read -r "REPLY?Press Enter to close..."
  exit 1
fi
if [[ ! -x "$PYTHON" ]]; then
  echo "The shared workspace Python environment was not found: $VENV"
  read -r "REPLY?Press Enter to close..."
  exit 1
fi
if ! "$PYTHON" -c 'import PySide6, PyInstaller' >/dev/null 2>&1; then
  echo "PySide6 or PyInstaller is missing from the shared workspace environment."
  echo "MailCue uses the same Python environment as Coding Deck."
  read -r "REPLY?Press Enter to close..."
  exit 1
fi

echo "Building MailCue with PySide6 and PyInstaller (same approach as Coding Deck)..."
cd "$PROJECT_DIR"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to synchronize package.json versions into manifest.xml."
  read -r "REPLY?Press Enter to close..."
  exit 1
fi
node scripts/sync-version.mjs
ICON_SOURCE="$PROJECT_DIR/assets/Icon 1024.png"
ICONSET_DIR="$PROJECT_DIR/build/mailcue.iconset"
mkdir -p "$ICONSET_DIR"
make_icon_pair() {
  local logical_size="$1" one_x_size="$2" two_x_size="$3"
  sips -z "$one_x_size" "$one_x_size" "$ICON_SOURCE" --out "$ICONSET_DIR/icon_${logical_size}x${logical_size}.png" >/dev/null
  sips -z "$two_x_size" "$two_x_size" "$ICON_SOURCE" --out "$ICONSET_DIR/icon_${logical_size}x${logical_size}@2x.png" >/dev/null
}
make_icon_pair 16 16 32
make_icon_pair 32 32 64
make_icon_pair 128 128 256
make_icon_pair 256 256 512
make_icon_pair 512 512 1024
iconutil -c icns "$ICONSET_DIR" -o "$PROJECT_DIR/build/mailcue.icns"
osascript -e 'tell application id "com.mailcue.personal" to quit' >/dev/null 2>&1 || true
sleep 2
"$PYTHON" -m PyInstaller --noconfirm --clean \
  --distpath "$DIST_DIR" --workpath "$PROJECT_DIR/build" \
  "$PROJECT_DIR/native/MailCue.spec"

APP_PATH="$DIST_DIR/MailCue.app"
BRIDGE_PATH=""
for candidate in \
  "$APP_PATH/Contents/Resources/bridge/server.mjs" \
  "$APP_PATH/Contents/Frameworks/bridge/server.mjs" \
  "$APP_PATH/Contents/MacOS/bridge/server.mjs"; do
  if [[ -f "$candidate" ]]; then
    BRIDGE_PATH="$candidate"
    break
  fi
done
if [[ -z "$BRIDGE_PATH" ]]; then
  echo "Build failed: bridge/server.mjs is missing from the app bundle."
  echo "Checked Contents/Resources, Contents/Frameworks, and Contents/MacOS."
  exit 1
fi
echo "Bundled Bridge: $BRIDGE_PATH"

echo "Signing MailCue.app..."
codesign --force --deep --sign - "$DIST_DIR/MailCue.app"
sh "$PROJECT_DIR/scripts/uninstall-login-item.sh"

echo "Built MailCue menu bar app: $DIST_DIR/MailCue.app"
echo "Starting it now. Choose Launch at Login from its menu to start it with macOS."
open -n "$DIST_DIR/MailCue.app"
echo "Cleaning temporary build files..."
rm -rf "$PROJECT_DIR/build" "$DIST_DIR/MailCue"
echo "Removed build/ and dist/MailCue/. Kept dist/MailCue.app and the latest 3 build logs."
read -r "REPLY?Press Enter to close..."
