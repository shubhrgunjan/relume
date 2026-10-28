#!/bin/sh
# Restart the relume MCP server (HTTP) in the background; logs to server.log.
cd "$(dirname "$0")/.." || exit 1
PIDS=$(pgrep -f "node.*src/mcp/server.ts")
[ -n "$PIDS" ] && kill $PIDS && sleep 1
RELUME_BASE_URL="${RELUME_BASE_URL:-http://agx-thor:8790}" setsid nohup npm run -s start > server.log 2>&1 < /dev/null &
sleep 4; cat server.log
