"""Generate the film's sound effects with ElevenLabs (key in ~/.config/elevenlabs_key) into audio/sfx/<name>.mp3.
Skips any that already exist, so it can be re-run after editing the list.

    python3 tools/sfx.py
"""
import json, pathlib, urllib.request

R = pathlib.Path(__file__).resolve().parent.parent
OUT = R / 'audio' / 'sfx'
OUT.mkdir(parents=True, exist_ok=True)
key = (pathlib.Path.home() / '.config/elevenlabs_key').read_text().strip()

SFX = {
    'pixel_tick': ('tiny crisp digital click, a single pixel blip, high pitched, dry, no reverb', 0.5),
    'scan_sweep': ('soft airy digital scanner sweep passing across, short, clean', 1.0),
    'paper_slap': ('a sheet of thick paper slapped down onto a table, crisp close paper impact', 0.6),
    'paper_tear': ('a quick sharp paper tear rip, close and dry', 0.8),
    'box_snap': ('precise UI snap, clicky magnetic lock into place, subtle and modern', 0.6),
    'riser': ('electronic riser building tension, rising filtered noise and synth, ends abruptly', 3.0),
    'impact': ('deep cinematic sub boom impact with a bright digital glitch transient on top', 2.0),
    'whoosh': ('fast airy whoosh passing the camera, clean and modern', 1.0),
    'glitch': ('digital glitch stutter, short data corruption burst, crisp', 0.8),
    'typing': ('soft mechanical keyboard typing burst, quick and light', 1.5),
    'counter': ('rapid soft digital counter ticking, small clicks speeding up', 1.0),
    'seam': ('smooth swipe transition with a light glassy shimmer', 0.8),
    'portal': ('huge deep tunnel whoosh rushing forward through space, airy, cinematic', 2.5),
    'chime': ('soft modern logo chime, warm and minimal, a single bell-like tone with a gentle shimmer tail', 2.5),
}

for name, (prompt, dur) in SFX.items():
    f = OUT / f'{name}.mp3'
    if f.exists():
        continue
    body = json.dumps({'text': prompt, 'duration_seconds': dur, 'prompt_influence': 0.55}).encode()
    req = urllib.request.Request('https://api.elevenlabs.io/v1/sound-generation', data=body, headers={'xi-api-key': key, 'Content-Type': 'application/json'})
    try:
        f.write_bytes(urllib.request.urlopen(req, timeout=120).read())
        print('ok', name)
    except Exception as e:
        print('failed', name, e)
