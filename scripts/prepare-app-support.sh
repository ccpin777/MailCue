#!/bin/sh
set -eu
SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TARGET_DIR="$HOME/Library/Application Support/MailCue"
mkdir -p "$TARGET_DIR/certs" "$TARGET_DIR/Private"
chmod 700 "$TARGET_DIR" "$TARGET_DIR/Private"
if [ ! -f "$TARGET_DIR/config.json" ]; then
  cp "$SOURCE_DIR/config.example.json" "$TARGET_DIR/config.json"
  chmod 600 "$TARGET_DIR/config.json"
fi
printf '%s\n' "Prepared private data folder: $TARGET_DIR" "Project code stays in: $SOURCE_DIR" "Edit: $TARGET_DIR/config.json"
