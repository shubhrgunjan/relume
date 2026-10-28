# relume MCP — real-world test log

Each test drives relume only through its MCP endpoint (`extract_site` → `job_status` → `get_skill` /
`see_reference` / `get_dna` → build → `check_style` → fix), the way an outside agent would. Every rough edge
becomes an issue below, and each fix is linked to the commit that made it.

## Test 1 — openhorizon.so → a car-parts site (28 Oct 2026)

Brief: same design language as openhorizon.so, product about car parts instead of robots. Private: not added to
the catalogue. Built by Claude acting as the agent, using only what the MCP returns.

### Issues found

| # | where | issue | status |
|---|---|---|---|
| 1 | `extract_site` | No way to measure a site without publishing it to the catalogue. | fixed: `catalog: false` writes a private marker; private entries are hidden from `search_catalog`, the catalogue page and exports, but every tool still works on the slug. |
| 2 | server | A running server keeps old code; nothing reports its version or when it was built. | open |
| 3 | client | This Claude Code session had no relume MCP registered, so the test calls the endpoint over HTTP JSON-RPC (`bench/mcp.sh`). Register it for real use: `claude mcp add --transport http relume http://agx-thor:8790/api/mcp`. | noted |
