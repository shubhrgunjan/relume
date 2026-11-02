#!/bin/sh
# One iteration: sync to the Thor, render the clone, compare it with the reference, pull the results into the studio.
#   sh bin/iterate.sh "what changed"
set -e
cd "$(dirname "$0")/.."
NOTE="$1"; P="python3 bin/progress.py"
N=$(python3 -c "import json;print(len(json.load(open('work/progress/state.json')).get('iterations',[]))+1)")
ID=$(printf 'it%02d' "$N")
$P log "iteration $N: rendering on the Thor — $NOTE" --kind work
rsync -az --exclude work ./ shubhr.pair.lab@agx-thor:~/relume/motion/
[ -n "$RESUME" ] || ssh shubhr.pair.lab@agx-thor "export PATH=\$HOME/annex-launch/node/bin:\$PATH; cd ~/relume/motion && mkdir -p work/renders && python3 engine/sound.py work/refs/harvey work/renders/sound.wav --sfx assets/sfx | tail -1 && node engine/render.cjs --page projects/harvey-relume/index.html --out work/renders/$ID.mp4 --fps 24 --workers 8 --audio work/renders/sound.wav 2>&1 | tail -1"
$P log "iteration $N: rendered, comparing with the reference…" --kind work
ssh shubhr.pair.lab@agx-thor "cd ~/relume/motion && python3 engine/compare.py work/refs/harvey work/renders/$ID.mp4 work/renders/$ID.check | tail -1"
mkdir -p work/renders
# the studio gets a light preview; the full render stays on the Thor for scoring
ssh shubhr.pair.lab@agx-thor "cd ~/relume/motion/work/renders && ffmpeg -v error -y -i $ID.mp4 -vf scale=960:540 -c:v libx264 -preset veryfast -crf 27 -c:a aac -b:a 128k -movflags +faststart $ID.preview.mp4"
rsync -az shubhr.pair.lab@agx-thor:~/relume/motion/work/renders/$ID.preview.mp4 work/renders/
rsync -az shubhr.pair.lab@agx-thor:~/relume/motion/work/renders/$ID.check work/renders/
$P iteration work/renders/$ID.check/report.json --video renders/$ID.preview.mp4 --note "$NOTE"
