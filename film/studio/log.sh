#!/bin/sh
# usage: log.sh [kind] "message"
D="$(dirname "$0")/data"
if [ $# -ge 2 ]; then K="$1"; M="$2"; else K=""; M="$1"; fi
python3 -c 'import json,sys,time;print(json.dumps({"ts":time.time(),"kind":sys.argv[1],"msg":sys.argv[2]}))' "$K" "$M" >> "$D/activity.jsonl"
