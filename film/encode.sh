#!/bin/sh
# 120 fps frames → 60 fps with two-frame motion blur, plus a mix. usage: sh encode.sh <mix.wav> <out.mp4>
set -e
cd "$(dirname "$0")"
ffmpeg -y -loglevel error -stats \
  -framerate 120 -i frames/f_%06d.jpg -i "$1" \
  -vf "tmix=frames=2:weights='1 1',fps=60,format=yuv420p" \
  -c:v libx264 -preset slow -crf 15 -profile:v high -tune film \
  -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart "$2"
ls -la "$2"
