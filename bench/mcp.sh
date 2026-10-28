#!/bin/sh
# Call one relume MCP tool over Streamable HTTP: bench/mcp.sh <tool> '<json args>'
curl -s "${RELUME_MCP:-http://agx-thor:8790/api/mcp}" -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":${2:-{\}}}}"
