#!/bin/sh
# Start relume on this machine: the MCP server (:8790) and the static server for recreations (:8801).
# To bring both back after a reboot, add to the crontab:  @reboot sleep 20 && sh $HOME/relume/bench/start-all.sh
cd "$(dirname "$0")/.." || exit 1
sh bench/restart-server.sh </dev/null >/dev/null 2>&1
pgrep -f "http.server 8801" >/dev/null || (cd data/transfer && setsid nohup python3 -m http.server 8801 >http.log 2>&1 </dev/null &)
