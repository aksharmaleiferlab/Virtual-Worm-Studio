#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Install Python 3.10 or newer, then run this script again."
  exit 1
fi
exec python3 launch.py "$@"
