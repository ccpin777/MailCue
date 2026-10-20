#!/bin/bash
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_DIR="$(cd "$DIR/../.." && pwd)"
PYTHON="$WORKSPACE_DIR/venv/bin/python"

# Match Coding Deck's clean Qt/PySide launch environment.
unset PYTHONPATH PYTHONHOME
unset DYLD_FALLBACK_FRAMEWORK_PATH DYLD_FALLBACK_LIBRARY_PATH
unset DYLD_LIBRARY_PATH DYLD_FRAMEWORK_PATH DYLD_INSERT_LIBRARIES
unset QML2_IMPORT_PATH QT_PLUGIN_PATH QT_QPA_PLATFORM_PLUGIN_PATH
unset _MEIPASS2 _PYI_ARCHIVE_FILE

if [[ ! -x "$PYTHON" ]]; then
  echo "The shared workspace Python environment was not found:"
  echo "  $PYTHON"
  read -r -p "Press Enter to close..."
  exit 1
fi

if ! "$PYTHON" -c 'import PySide6' >/dev/null 2>&1; then
  echo "PySide6 is missing from the shared workspace Python environment."
  echo "MailCue uses the same Python environment as Coding Deck."
  read -r -p "Press Enter to close..."
  exit 1
fi

echo "Starting MailCue directly from source (no app build)."
echo "Keep this Terminal window open while testing."
echo
"$PYTHON" "$DIR/native/mailcue_menubar.py"
run_status=$?

echo
if [[ "$run_status" -eq 0 ]]; then
  echo "MailCue closed. Press Enter to close this window..."
else
  echo "MailCue exited with code $run_status. Copy the error above, then press Enter to close..."
fi
read -r -p ""
exit "$run_status"
