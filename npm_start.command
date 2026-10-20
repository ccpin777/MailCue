#!/bin/zsh

cd "$(dirname "$0")" || exit 1

echo "Removing any obsolete Bridge login item..."
sh scripts/uninstall-login-item.sh
if ! command -v node >/dev/null 2>&1; then
  echo "Could not find Node.js in this Terminal environment."
  echo "Install Node.js 22+ or start MailCue from a Terminal where 'node' works."
  echo "This window will stay open so you can read the error."
  exec /bin/zsh -i
fi
echo "Starting MailCue. Keep this window open while using the add-in. Close it to stop MailCue."
node bridge/server.mjs
exit_code=$?
echo
echo "MailCue stopped (exit code $exit_code)."
echo "This window will stay open so you can read the error or close it yourself."
exec /bin/zsh -i
