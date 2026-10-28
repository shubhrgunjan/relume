#!/bin/sh
# Serve the landing page and recreations on this machine: http://127.0.0.1:${PORT:-4321}/
cd "$(dirname "$0")/../site" && exec python3 -m http.server "${PORT:-4321}" --bind "${BIND:-127.0.0.1}"
