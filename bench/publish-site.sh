#!/bin/sh
# Rebuild the site's catalogue from every registered recreation and deploy it.
# Run by the MCP server after each check against a public entry (RELUME_PUBLISH="sh bench/publish-site.sh"),
# or by hand. Deploys with the Vercel CLI when VERCEL_TOKEN is set and site/.vercel/project.json links a project.
cd "$(dirname "$0")/.." || exit 1
[ -d "$HOME/annex-launch/node/bin" ] && PATH="$HOME/annex-launch/node/bin:$PATH"
LOCK=/tmp/relume-publish.lock
# one publish at a time; a check that lands meanwhile asks for one more run
if ! mkdir "$LOCK" 2>/dev/null; then touch "$LOCK/again"; exit 0; fi
trap 'rm -rf "$LOCK"' EXIT
while :; do
  rm -f "$LOCK/again"
  OUT=$(mktemp -d)
  node bench/export-site.mjs "$OUT" >> publish.log 2>&1 || { echo "$(date -Is) export failed" >> publish.log; rm -rf "$OUT"; exit 1; }
  mkdir -p site/data site/media site/recreations
  cp "$OUT/compare.json" site/data/compare.json
  cp -r "$OUT/media/." site/media/
  [ -d "$OUT/recreations" ] && cp -r "$OUT/recreations/." site/recreations/
  [ -d "$OUT/skills" ] && mkdir -p site/skills && cp -r "$OUT/skills/." site/skills/
  rm -rf "$OUT"
  echo "$(date -Is) exported $(node -p 'require("./site/data/compare.json").length') recreations" >> publish.log
  if [ -n "${VERCEL_TOKEN:-}" ] && [ -f site/.vercel/project.json ]; then
    (cd site && npx --yes vercel@latest deploy --prod --yes --token "$VERCEL_TOKEN" >> ../publish.log 2>&1) && echo "$(date -Is) deployed" >> publish.log
  fi
  [ -f "$LOCK/again" ] || break
done
