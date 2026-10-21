#!/bin/bash

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR" || exit 1

echo "Pushing committed MailCue changes to GitHub..."
echo "Uncommitted files are not included."
echo

git push
push_result=$?

echo
if [ "$push_result" -eq 0 ]; then
  echo "Push completed."
else
  echo "Push failed. Check the message above; GitHub sign-in may be required."
fi

echo
read -r -p "Press Return to close this window..."
exit "$push_result"
