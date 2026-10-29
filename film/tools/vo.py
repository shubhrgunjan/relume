"""Voiceover with ElevenLabs, with per-word timestamps for the kinetic captions.
Writes vo/<name>.mp3 and vo/<name>.json ({words: [{w, start, end}], duration}).

    python3 tools/vo.py <name> <voice_id> [stability] [style]
"""
import base64, json, pathlib, sys, urllib.request

R = pathlib.Path(__file__).resolve().parent.parent
name, voice = sys.argv[1], sys.argv[2]
stability = float(sys.argv[3]) if len(sys.argv) > 3 else 0.55
style = float(sys.argv[4]) if len(sys.argv) > 4 else 0.25
key = (pathlib.Path.home() / '.config/elevenlabs_key').read_text().strip()
# "relume" is read as one soft word, not an acronym
text = ' '.join((R / 'vo' / 'script.txt').read_text().split()).replace('relume', 'reloom')
body = json.dumps({'text': text, 'model_id': 'eleven_multilingual_v2',
                   'voice_settings': {'stability': stability, 'similarity_boost': 0.8, 'style': style, 'use_speaker_boost': True, 'speed': 0.95}}).encode()
req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128',
                             data=body, headers={'xi-api-key': key, 'Content-Type': 'application/json'})
d = json.load(urllib.request.urlopen(req, timeout=180))
(R / 'vo' / f'{name}.mp3').write_bytes(base64.b64decode(d['audio_base64']))
a = d['alignment']
chars, st, en = a['characters'], a['character_start_times_seconds'], a['character_end_times_seconds']
words, cur, s0 = [], '', None
for ch, s, e in zip(chars, st, en):
    if ch.isspace():
        if cur: words.append({'w': cur, 'start': round(s0, 3), 'end': round(last, 3)}); cur = ''
        continue
    if not cur: s0 = s
    cur += ch; last = e
if cur: words.append({'w': cur, 'start': round(s0, 3), 'end': round(last, 3)})
for w in words: w['w'] = w['w'].replace('reloom', 'relume').replace('Reloom', 'relume')
json.dump({'voice': voice, 'words': words, 'duration': round(en[-1], 3)}, open(R / 'vo' / f'{name}.json', 'w'), indent=1)
print(name, 'words', len(words), 'duration', round(en[-1], 2))
