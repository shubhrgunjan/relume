#!/bin/sh
# (Re)start the relume motion MCP on :8792. Uses a pid file, not pkill -f, so it never matches its own shell.
export PATH=$HOME/annex-launch/node/bin:$PATH
cd "$(dirname "$0")/.." || exit 1
[ -f work/mcp.pid ] && kill "$(cat work/mcp.pid)" 2>/dev/null
setsid nohup node --disable-warning=ExperimentalWarning --import tsx src/server.ts > work/mcp.log 2>&1 < /dev/null &
echo $! > work/mcp.pid
