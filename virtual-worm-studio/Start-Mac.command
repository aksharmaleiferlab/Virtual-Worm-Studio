#!/bin/sh
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 launch.py "$@"
else
  echo "Install Python 3.10 or newer from https://www.python.org/downloads/ then try again."
fi
printf '\nPress Return to close this window.'
read -r answer
