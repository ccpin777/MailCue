#!/bin/zsh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_DIR="$(cd "$PROJECT_DIR/../.." && pwd)"
VENV="$WORKSPACE_DIR/venv"
PYTHON="$VENV/bin/python"
DIST_DIR="$PROJECT_DIR/dist"
LOG_DIR="$PROJECT_DIR/build-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/build-menubar-$(date +%Y%m%d-%H%M%S).log"
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
rm -rf "$PROJECT_DIR/build" "$DIST_DIR/MailCue" "$LOG_DIR"
echo "Removed build/, build-logs/, and dist/MailCue/. Kept dist/MailCue.app."
read -r "REPLY?Press Enter to close..."
