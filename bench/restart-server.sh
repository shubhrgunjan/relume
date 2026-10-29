#!/bin/sh
# Restart the relume MCP server (HTTP) in the background; logs to server.log.
cd "$(dirname "$0")/.." || exit 1
[ -d "$HOME/annex-launch/node/bin" ] && PATH="$HOME/annex-launch/node/bin:$PATH"
PIDS=$(pgrep -f "node.*src/mcp/server.ts")
[ -n "$PIDS" ] && kill $PIDS && sleep 1
# secrets (VERCEL_TOKEN) live outside the repo; each check against a public entry republishes the catalogue
[ -f "$HOME/.relume-env" ] && . "$HOME/.relume-env" && export VERCEL_TOKEN
export RELUME_PUBLISH="${RELUME_PUBLISH:-sh $(pwd)/bench/publish-site.sh}"
RELUME_BASE_URL="${RELUME_BASE_URL:-http://agx-thor:8790}" setsid nohup npm run -s start > server.log 2>&1 < /dev/null &
sleep 4; head -5 server.log
