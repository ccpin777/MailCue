#!/bin/sh
set -eu
LABEL="local.outlook-assistant.bridge"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$PLIST"
printf '%s\n' "Removed $LABEL"
