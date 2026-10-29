#!/bin/sh
# relume installer
#
#   curl -fsSL https://relume.shubhrgunjan.me/install.sh | sh
#   curl -fsSL https://relume.shubhrgunjan.me/install.sh | sh -s -- --agents claude,codex --yes
#
# Installs relume on this machine with everything it needs (Node 20+, git, ffmpeg, a headless browser), finds the
# coding agents you have (Claude Code, Codex, Gemini CLI, Antigravity, Cursor, Windsurf, VS Code, OpenCode, Goose)
# and registers relume's MCP server with all of them or the ones you pick.
#
# Options (or the matching RELUME_* environment variables):
#   --agents all|none|claude,codex,…   which agents to set up (default: ask)
#   --remote URL                       use a running relume server (…/api/mcp) instead of installing locally
#   --dir PATH                         install location (default ~/.relume)
#   --yes                              no questions: install missing dependencies and set up every agent found
#   --dry-run                          show what would happen, change nothing
#   --uninstall                        remove relume from every agent's config (and --purge also deletes ~/.relume)
set -eu
main() {

DIR="${RELUME_DIR:-$HOME/.relume}"
REPO="${RELUME_REPO:-https://github.com/shubhrgunjan/relume.git}"
REMOTE="${RELUME_REMOTE:-}"
AGENTS="${RELUME_AGENTS:-}"
YES=0; DRY=0; UNINSTALL=0; PURGE=0
NODE_MAJOR=22

while [ $# -gt 0 ]; do
  case "$1" in
    --agents) AGENTS="$2"; shift ;; --agents=*) AGENTS="${1#*=}" ;;
    --remote) REMOTE="$2"; shift ;; --remote=*) REMOTE="${1#*=}" ;;
    --dir) DIR="$2"; shift ;; --dir=*) DIR="${1#*=}" ;;
    -y|--yes) YES=1 ;; --dry-run) DRY=1 ;; --uninstall) UNINSTALL=1 ;; --purge) UNINSTALL=1; PURGE=1 ;;
    -h|--help) sed -n '2,21p' "$0" 2>/dev/null || true; exit 0 ;;
    *) printf 'unknown option: %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

# ---------------------------------------------------------------- output and prompts
if [ -t 1 ]; then B=$(printf '\033[1m'); G=$(printf '\033[32m'); Y=$(printf '\033[33m'); R=$(printf '\033[31m'); D=$(printf '\033[2m'); N=$(printf '\033[0m'); else B= G= Y= R= D= N=; fi
say() { printf '%s›%s %s\n' "$G" "$N" "$*"; }
note() { printf '  %s%s%s\n' "$D" "$*" "$N"; }
warn() { printf '%s!%s %s\n' "$Y" "$N" "$*"; }
die() { printf '%s✗%s %s\n' "$R" "$N" "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }
run() { if [ "$DRY" = 1 ]; then note "would run: $*" >&2; else "$@"; fi; }
# questions go to the terminal even when this script arrives through a pipe
TTY=""; if [ "$YES" = 0 ] && [ -r /dev/tty ] && [ -w /dev/tty ] && (: </dev/tty) 2>/dev/null; then TTY=/dev/tty; fi
ask() { # ask "question" default → answer
  if [ -z "$TTY" ]; then printf '%s' "$2"; return; fi
  printf '%s?%s %s %s[%s]%s ' "$B" "$N" "$1" "$D" "$2" "$N" >"$TTY"; read -r a <"$TTY" || a=""; printf '%s' "${a:-$2}"
}
yes_no() { case "$(ask "$1" "${2:-Y}")" in [Yy]*) return 0 ;; *) return 1 ;; esac; }

printf '\n%srelume%s · measure a site, give your agent its taste\n\n' "$B" "$N"

# agent CLIs often live outside a plain shell's PATH
for d in "$HOME/.local/bin" "$HOME/.claude/local" "$HOME/.npm-global/bin" "$HOME/.bun/bin" "$HOME/.volta/bin" /opt/homebrew/bin /usr/local/bin "$HOME/.antigravity/bin" "$HOME/.opencode/bin"; do
  [ -d "$d" ] && case ":$PATH:" in *":$d:"*) ;; *) PATH="$PATH:$d" ;; esac
done
for d in "$HOME"/.nvm/versions/node/*/bin; do [ -d "$d" ] && PATH="$PATH:$d"; done
export PATH
NOTES=""   # what needs the user's attention, repeated in the summary
later() { NOTES="$NOTES
  • $*"; warn "$*"; }

# ---------------------------------------------------------------- platform
OS=$(uname -s); ARCH=$(uname -m)
case "$OS" in Linux) PLAT=linux ;; Darwin) PLAT=darwin ;; *) die "Unsupported OS: $OS (Linux and macOS are supported; on Windows use WSL)." ;; esac
case "$ARCH" in x86_64|amd64) NARCH=x64 ;; arm64|aarch64) NARCH=arm64 ;; *) die "Unsupported CPU: $ARCH" ;; esac
SUDO=""; if [ "$(id -u)" != 0 ]; then have sudo && SUDO=sudo; fi
PM=""
for p in brew apt-get dnf yum pacman zypper apk; do if have "$p"; then PM=$p; break; fi; done
pkg_install() { # pkg_install <name…>
  case "$PM" in
    brew) run env HOMEBREW_NO_AUTO_UPDATE=1 brew install "$@" </dev/null ;;
    apt-get) run $SUDO apt-get update -qq </dev/null && run $SUDO apt-get install -y -qq "$@" </dev/null ;;
    dnf|yum) run $SUDO "$PM" install -y -q "$@" </dev/null ;;
    pacman) run $SUDO pacman -S --noconfirm --needed "$@" </dev/null ;;
    zypper) run $SUDO zypper -n install "$@" </dev/null ;;
    apk) run $SUDO apk add --no-cache "$@" </dev/null ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------- agents: detection and registration
LAUNCH="$DIR/bin/relume-mcp"
# name|label|detected?
detect_agents() {
  FOUND=""
  { have claude || [ -f "$HOME/.claude.json" ] || [ -d "$HOME/.claude" ]; } && FOUND="$FOUND claude"
  { have codex || [ -d "$HOME/.codex" ]; } && FOUND="$FOUND codex"
  { have gemini || [ -d "$HOME/.gemini" ]; } && FOUND="$FOUND gemini"
  { have agy || have antigravity || [ -d "$HOME/.gemini/antigravity" ]; } && FOUND="$FOUND antigravity"
  { have cursor || have cursor-agent || [ -d "$HOME/.cursor" ]; } && FOUND="$FOUND cursor"
  { have windsurf || [ -d "$HOME/.codeium/windsurf" ]; } && FOUND="$FOUND windsurf"
  have code && FOUND="$FOUND vscode"
  { have opencode || [ -d "$HOME/.config/opencode" ]; } && FOUND="$FOUND opencode"
  { have goose || [ -d "$HOME/.config/goose" ]; } && FOUND="$FOUND goose"
  FOUND="${FOUND# }"
}
label() { case "$1" in claude) echo "Claude Code" ;; codex) echo "Codex" ;; gemini) echo "Gemini CLI" ;; antigravity) echo "Antigravity (agy)" ;; cursor) echo "Cursor" ;; windsurf) echo "Windsurf" ;; vscode) echo "VS Code (Copilot)" ;; opencode) echo "OpenCode" ;; goose) echo "Goose" ;; *) echo "$1" ;; esac; }

# JSON configs with an "mcpServers" map (Cursor, Gemini CLI, Antigravity, Windsurf); node is installed by now
json_mcp() { # json_mcp <file> add|remove
  [ "$DRY" = 1 ] && { note "would $2 relume in $1"; return; }
  "$NODE" -e '
    const fs = require("fs"), path = require("path"), [f, op, launch, remote] = process.argv.slice(1);
    let j = {}; try { j = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
    j.mcpServers = j.mcpServers || {};
    if (op === "remove") delete j.mcpServers.relume;
    else j.mcpServers.relume = remote ? { type: "http", url: remote, serverUrl: remote } : { type: "stdio", command: launch, args: [] };
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
  ' "$1" "$2" "$LAUNCH" "$REMOTE"
}
toml_mcp() { # Codex: ~/.codex/config.toml
  CFG="$HOME/.codex/config.toml"
  [ "$DRY" = 1 ] && { note "would $1 relume in $CFG"; return; }
  mkdir -p "$HOME/.codex"; touch "$CFG"
  awk 'BEGIN{s=0} /^\[mcp_servers\.relume(\.|\])/{s=1; next} /^\[/{s=0} !s' "$CFG" > "$CFG.tmp" && mv "$CFG.tmp" "$CFG"
  [ "$1" = remove ] && return
  if [ -n "$REMOTE" ]; then printf '\n[mcp_servers.relume]\nurl = "%s"\n' "$REMOTE" >> "$CFG"
  else printf '\n[mcp_servers.relume]\ncommand = "%s"\nstartup_timeout_sec = 60.0\ntool_timeout_sec = 900.0\n' "$LAUNCH" >> "$CFG"; fi
}
opencode_mcp() {
  F="$HOME/.config/opencode/opencode.json"
  [ "$DRY" = 1 ] && { note "would $1 relume in $F"; return; }
  "$NODE" -e '
    const fs = require("fs"), path = require("path"), [f, op, launch, remote] = process.argv.slice(1);
    let j = {}; try { j = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
    j.mcp = j.mcp || {};
    if (op === "remove") delete j.mcp.relume;
    else j.mcp.relume = remote ? { type: "remote", url: remote, enabled: true } : { type: "local", command: [launch], enabled: true };
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
  ' "$F" "$1" "$LAUNCH" "$REMOTE"
}
goose_mcp() {
  F="$HOME/.config/goose/config.yaml"
  [ "$DRY" = 1 ] && { note "would $1 relume in $F"; return; }
  mkdir -p "$(dirname "$F")"; touch "$F"
  awk 'BEGIN{s=0} /^  relume:/{s=1; next} s && /^  [^ ]/{s=0} s && /^[^ ]/{s=0} !s' "$F" > "$F.tmp" && mv "$F.tmp" "$F"
  [ "$1" = remove ] && return
  grep -q '^extensions:' "$F" || printf 'extensions:\n' >> "$F"
  if [ -n "$REMOTE" ]; then BLOCK="  relume:\n    name: relume\n    type: streamable_http\n    uri: $REMOTE\n    enabled: true\n    timeout: 900\n"
  else BLOCK="  relume:\n    name: relume\n    type: stdio\n    cmd: $LAUNCH\n    args: []\n    enabled: true\n    timeout: 900\n"; fi
  awk -v b="$BLOCK" '{print} /^extensions:/{printf b}' "$F" > "$F.tmp" && mv "$F.tmp" "$F"
}
setup_agent() { # setup_agent <name> add|remove
  case "$1" in
    claude)
      if ! have claude; then json_mcp "$HOME/.claude.json" "$2"; return; fi
      run claude mcp remove relume --scope user >/dev/null 2>&1 </dev/null || true
      [ "$2" = remove ] && return
      if [ -n "$REMOTE" ]; then run claude mcp add --scope user --transport http relume "$REMOTE" >/dev/null </dev/null
      else run claude mcp add --scope user relume -- "$LAUNCH" >/dev/null </dev/null; fi ;;
    codex) toml_mcp "$2" ;;
    gemini) json_mcp "$HOME/.gemini/settings.json" "$2" ;;
    antigravity) json_mcp "$HOME/.gemini/antigravity/mcp_config.json" "$2" ;;
    cursor) json_mcp "$HOME/.cursor/mcp.json" "$2" ;;
    windsurf) json_mcp "$HOME/.codeium/windsurf/mcp_config.json" "$2" ;;
    vscode)
      [ "$2" = remove ] && { note "VS Code: remove 'relume' under MCP: List Servers"; return; }
      if [ -n "$REMOTE" ]; then run code --add-mcp "{\"name\":\"relume\",\"type\":\"http\",\"url\":\"$REMOTE\"}" >/dev/null </dev/null
      else run code --add-mcp "{\"name\":\"relume\",\"type\":\"stdio\",\"command\":\"$LAUNCH\"}" >/dev/null </dev/null; fi ;;
    opencode) opencode_mcp "$2" ;;
    goose) goose_mcp "$2" ;;
  esac
}

# ---------------------------------------------------------------- uninstall
if [ "$UNINSTALL" = 1 ]; then
  NODE=$(command -v node || echo "$DIR/node/bin/node")
  detect_agents
  for a in $FOUND; do setup_agent "$a" remove && say "removed from $(label "$a")"; done
  [ "$PURGE" = 1 ] && run rm -rf "$DIR" && say "deleted $DIR"
  exit 0
fi

# ---------------------------------------------------------------- dependencies
NODE=""
node_ok() { have node && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] 2>/dev/null; }
if [ -z "$REMOTE" ]; then
  say "Checking what relume needs"
  # Node 20+: the system one if new enough, otherwise a private copy inside $DIR (no sudo, nothing else touched)
  if node_ok; then NODE=$(command -v node); note "node $(node -v)"
  elif [ -x "$DIR/node/bin/node" ]; then NODE="$DIR/node/bin/node"; note "node $("$NODE" -v) (relume's own)"
  else
    have node && note "node $(node -v) is too old; relume needs 20+" || note "node not found"
    if [ -n "$TTY" ] && ! yes_no "Install Node $NODE_MAJOR for relume (inside $DIR, no sudo)?" Y; then die "Node 20+ is required."; fi
    have curl || die "curl is required to download Node."
    EXT=tar.xz; [ "$PLAT" = darwin ] && EXT=tar.gz
    FILE=$(curl -fsSL "https://nodejs.org/dist/latest-v$NODE_MAJOR.x/SHASUMS256.txt" | awk -v p="node-v.*-$PLAT-$NARCH.$EXT" '$2 ~ p {print $2; exit}')
    [ -n "$FILE" ] || die "Could not find a Node $NODE_MAJOR build for $PLAT-$NARCH."
    say "Downloading $FILE"
    if [ "$DRY" = 0 ]; then
      mkdir -p "$DIR/node"
      curl -fsSL "https://nodejs.org/dist/latest-v$NODE_MAJOR.x/$FILE" </dev/null | tar -x$( [ "$EXT" = tar.xz ] && echo J || echo z )f - -C "$DIR/node" --strip-components 1
    fi
    NODE="$DIR/node/bin/node"
  fi
  NODEBIN=$(dirname "$NODE"); PATH="$NODEBIN:$PATH"; export PATH

  if ! have git; then
    note "git not found"
    if [ "$PLAT" = darwin ] && ! have brew; then run xcode-select --install </dev/null 2>/dev/null || true; die "git comes with Apple's command line tools: finish the install that just opened, then run this again."; fi
    if [ -z "$PM" ]; then die "git is required; install it and run this again."; fi
    if [ -n "$TTY" ] && ! yes_no "Install git with $PM${SUDO:+ (asks for your password)}?" Y; then die "git is required."; fi
    pkg_install git || die "Could not install git; install it and run this again."
  fi
  mkdir -p "$DIR/bin"; PATH="$DIR/bin:$PATH"
  if have ffmpeg; then note "ffmpeg $(ffmpeg -version 2>/dev/null | awk 'NR==1{print $3}')"
  else
    # a ready-made static build inside $DIR (works on old macOS where Homebrew would compile from source)
    say "Getting ffmpeg (a static build, inside $DIR)"
    if [ "$DRY" = 0 ] && sh -c "cd '$DIR' && mkdir -p .ffmpeg && '$NODEBIN/npm' install --prefix .ffmpeg --silent --no-audit --no-fund ffmpeg-static >/dev/null 2>&1" </dev/null && [ -x "$DIR/.ffmpeg/node_modules/ffmpeg-static/ffmpeg" ]; then
      ln -sf "$DIR/.ffmpeg/node_modules/ffmpeg-static/ffmpeg" "$DIR/bin/ffmpeg"; note "ffmpeg ready"
    elif [ -n "$PM" ] && [ "$PM" != brew ]; then pkg_install ffmpeg || true; fi
    have ffmpeg || [ "$DRY" = 1 ] || later "ffmpeg could not be installed: extraction works, but motion and behaviour analysis will be limited."
  fi

  # ---------------------------------------------------------------- relume itself
  if [ -d "$DIR/.git" ]; then say "Updating relume in $DIR"; run git -C "$DIR" pull --ff-only --quiet </dev/null || later "Could not update $DIR (local changes?); kept the installed version."
  else
    say "Downloading relume into $DIR"
    if [ "$DRY" = 0 ]; then
      mkdir -p "$DIR"; TMP="$DIR/.src"; rm -rf "$TMP"
      if ! git clone --quiet --depth 1 "$REPO" "$TMP" 2>/dev/null </dev/null; then
        { have gh && gh repo clone shubhrgunjan/relume "$TMP" -- --depth 1 --quiet </dev/null; } || die "Could not download $REPO (private for now? run 'gh auth login' first)."
      fi
      # keep a private node/ that may already be in $DIR
      cp -R "$TMP/." "$DIR/" && rm -rf "$TMP"
    fi
  fi
  say "Installing relume's packages"
  run sh -c "cd '$DIR' && '$NODEBIN/npm' install --silent --no-audit --no-fund >/dev/null" </dev/null || die "npm install failed in $DIR"
  say "Installing the headless browser relume measures with"
  BROWSER_ENV=""
  PWLOG="$DIR/.playwright-install.log"
  if [ "$PLAT" = linux ] && [ -n "$SUDO$( [ "$(id -u)" = 0 ] && echo root)" ] && run sh -c "cd '$DIR' && '$NODEBIN/npx' --yes playwright install --with-deps chromium >'$PWLOG' 2>&1" </dev/null; then note "chromium ready"
  elif run sh -c "cd '$DIR' && '$NODEBIN/npx' --yes playwright install chromium >'$PWLOG' 2>&1" </dev/null; then note "chromium ready"
  else
    note "Playwright has no Chromium for this system ($(tail -1 "$PWLOG" 2>/dev/null | cut -c1-80))"
    for app in "/Applications/Google Chrome.app:chrome" "/Applications/Microsoft Edge.app:msedge" "/opt/google/chrome/chrome:chrome" "/usr/bin/google-chrome:chrome" "/usr/bin/microsoft-edge:msedge"; do
      [ -e "${app%:*}" ] && { BROWSER_ENV="RELUME_BROWSER_CHANNEL=${app##*:}"; break; }
    done
    if [ -z "$BROWSER_ENV" ]; then for exe in "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" "/Applications/Chromium.app/Contents/MacOS/Chromium" /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/brave-browser; do [ -x "$exe" ] && { BROWSER_ENV="RELUME_BROWSER_PATH='$exe'"; break; }; done; fi
    if [ -n "$BROWSER_ENV" ]; then note "using your installed browser ($BROWSER_ENV)"
    else later "No browser relume can drive: install Google Chrome, then run this again."; fi
  fi

  # one launcher every agent runs: works from any working directory, with relume's node and data
  if [ "$DRY" = 0 ]; then
    mkdir -p "$DIR/bin" "$DIR/data/catalog"
    cat > "$LAUNCH" <<EOF
#!/bin/sh
# relume MCP server (stdio). Registered with your agents by install.sh.
export PATH="$DIR/bin:$NODEBIN:\$PATH" RELUME_DATA="\${RELUME_DATA:-$DIR/data}" ${BROWSER_ENV}
cd "$DIR" && exec "$NODE" --disable-warning=ExperimentalWarning --import tsx src/mcp/stdio.ts "\$@"
EOF
    cat > "$DIR/bin/relume" <<EOF
#!/bin/sh
# relume CLI: relume extract <url> · relume check <slug> <url> · relume list
export PATH="$DIR/bin:$NODEBIN:\$PATH" RELUME_DATA="\${RELUME_DATA:-$DIR/data}" ${BROWSER_ENV}
cd "$DIR" && exec "$NODE" --disable-warning=ExperimentalWarning --import tsx src/cli.ts "\$@"
EOF
    chmod +x "$LAUNCH" "$DIR/bin/relume"
    # quick self-test: the server must answer an MCP initialize
    if printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"install","version":"1"}}}' | (perl -e 'alarm 40; exec @ARGV' "$LAUNCH" 2>/dev/null || true) | grep -q '"serverInfo"'; then note "MCP server answers"; else later "The MCP server did not answer a test request; run $LAUNCH to see why."; fi
  fi
fi

# ---------------------------------------------------------------- which agents
detect_agents
if [ -z "$FOUND" ]; then
  warn "No coding agent found. Register relume by hand: command '$LAUNCH' (stdio)${REMOTE:+, or URL $REMOTE}."
  exit 0
fi
printf '\n%sFound these agents:%s\n' "$B" "$N"
i=0; for a in $FOUND; do i=$((i + 1)); printf '  %s%d%s  %s\n' "$B" "$i" "$N" "$(label "$a")"; done
if [ -z "$AGENTS" ]; then
  if [ -z "$TTY" ]; then AGENTS=all
  else
    printf '\n'
    ans=$(ask "Set up relume in: (a)ll, (n)one, or numbers like 1 3" a)
    case "$ans" in [Aa]*) AGENTS=all ;; [Nn]*) AGENTS=none ;; *) AGENTS=""; for n in $(echo "$ans" | tr ',' ' '); do j=0; for a in $FOUND; do j=$((j + 1)); [ "$j" = "$n" ] && AGENTS="$AGENTS,$a"; done; done ;; esac
  fi
fi
CHOSEN=""
case "$AGENTS" in
  all) CHOSEN="$FOUND" ;;
  none|"") CHOSEN="" ;;
  *) for a in $(echo "$AGENTS" | tr ',' ' '); do case " $FOUND " in *" $a "*) CHOSEN="$CHOSEN $a" ;; *) warn "$(label "$a") was not found on this machine; skipped." ;; esac; done ;;
esac

printf '\n'
for a in $CHOSEN; do
  if setup_agent "$a" add; then say "relume added to $(label "$a")"; else warn "Could not set up $(label "$a")"; fi
done
[ -z "$CHOSEN" ] && note "No agent changed. Run again with --agents all (or a list) when you want it."

printf '\n'
if [ -z "$REMOTE" ]; then
  say "relume is installed in $DIR"
  note "CLI: $DIR/bin/relume list · restart your agent to load the MCP"
fi
[ -n "$NOTES" ] && printf '\n%sNeeds your attention:%s%s\n' "$Y" "$N" "$NOTES"
note "Try: \"extract https://linear.app with relume and build me a page in its language\""
}

# everything above is read before anything runs, so a command that reads stdin can never eat the script
main "$@"
