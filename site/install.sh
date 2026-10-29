#!/bin/sh
# relume installer: curl -fsSL https://relume.shubhrgunjan.me/install.sh | sh
#
# Installs relume on this machine (source, dependencies, a headless browser) and registers its MCP server with
# every coding agent it finds: Claude Code, Codex, Cursor and Gemini CLI.
#
#   RELUME_DIR=~/.relume                      where to install (default)
#   RELUME_REMOTE=http://host:8790/api/mcp    register a running relume server instead of installing locally
#   RELUME_REPO=https://github.com/shubhrgunjan/relume.git
set -eu

DIR="${RELUME_DIR:-$HOME/.relume}"
REPO="${RELUME_REPO:-https://github.com/shubhrgunjan/relume.git}"
REMOTE="${RELUME_REMOTE:-}"

say() { printf '\033[1;32m›\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

if [ -z "$REMOTE" ]; then
  have node || die "Node.js 20+ is required (https://nodejs.org)."
  major=$(node -p 'process.versions.node.split(".")[0]')
  [ "$major" -ge 20 ] || die "Node.js 20+ is required (found $(node -v))."
  have git || die "git is required."
  have ffmpeg || warn "ffmpeg not found: install it for motion and behaviour analysis (apt install ffmpeg / brew install ffmpeg)."

  if [ -d "$DIR/.git" ]; then
    say "Updating relume in $DIR"
    git -C "$DIR" pull --ff-only --quiet
  else
    say "Installing relume into $DIR"
    if ! git clone --quiet --depth 1 "$REPO" "$DIR" 2>/dev/null; then
      have gh && gh repo clone shubhrgunjan/relume "$DIR" -- --depth 1 --quiet || die "Could not clone $REPO (is it private? run 'gh auth login' first)."
    fi
  fi
  say "Installing dependencies"
  (cd "$DIR" && npm install --silent --no-audit --no-fund >/dev/null)
  say "Installing the headless browser relume measures with"
  (cd "$DIR" && npx --yes playwright install chromium >/dev/null)
  mkdir -p "$DIR/data/catalog"
  CMD="npm"
  ARGS="--prefix $DIR run -s stdio"
fi

registered=""

# Claude Code
if have claude; then
  claude mcp remove relume --scope user >/dev/null 2>&1 || true
  if [ -n "$REMOTE" ]; then claude mcp add --scope user --transport http relume "$REMOTE" >/dev/null
  else claude mcp add --scope user -e RELUME_DATA="$DIR/data" relume -- $CMD $ARGS >/dev/null; fi
  registered="$registered Claude-Code"
fi

# Codex (~/.codex/config.toml)
if have codex || [ -d "$HOME/.codex" ]; then
  mkdir -p "$HOME/.codex"; CFG="$HOME/.codex/config.toml"; touch "$CFG"
  # drop an earlier relume block, then append the current one
  awk 'BEGIN{skip=0} /^\[mcp_servers\.relume(\.|\])/{skip=1; next} /^\[/{skip=0} !skip' "$CFG" > "$CFG.tmp" && mv "$CFG.tmp" "$CFG"
  if [ -n "$REMOTE" ]; then
    printf '\n[mcp_servers.relume]\nurl = "%s"\n' "$REMOTE" >> "$CFG"
  else
    printf '\n[mcp_servers.relume]\ncommand = "npm"\nargs = ["--prefix", "%s", "run", "-s", "stdio"]\nstartup_timeout_sec = 60.0\ntool_timeout_sec = 900.0\n\n[mcp_servers.relume.env]\nRELUME_DATA = "%s/data"\n' "$DIR" "$DIR" >> "$CFG"
  fi
  registered="$registered Codex"
fi

# JSON-configured agents: Cursor (~/.cursor/mcp.json), Gemini CLI (~/.gemini/settings.json)
json_add() { # file
  node -e '
    const fs = require("fs"), [f, dir, remote] = process.argv.slice(1);
    let j = {}; try { j = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
    j.mcpServers = j.mcpServers || {};
    j.mcpServers.relume = remote ? { url: remote } : { command: "npm", args: ["--prefix", dir, "run", "-s", "stdio"], env: { RELUME_DATA: dir + "/data" } };
    fs.mkdirSync(require("path").dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
  ' "$1" "$DIR" "$REMOTE"
}
if [ -d "$HOME/.cursor" ]; then json_add "$HOME/.cursor/mcp.json"; registered="$registered Cursor"; fi
if [ -d "$HOME/.gemini" ]; then json_add "$HOME/.gemini/settings.json"; registered="$registered Gemini-CLI"; fi

echo
if [ -n "$registered" ]; then say "relume MCP registered with:$registered"
else warn "No supported agent found. Add it by hand: command 'npm', args '--prefix $DIR run -s stdio'."; fi
[ -z "$REMOTE" ] && say "Installed in $DIR · try: \"extract https://linear.app with relume and build me a page in its language\""
