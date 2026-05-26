// Quick test для Dramabox TTS с reference voice.
import { readFile, writeFile } from 'node:fs/promises';

const TOKEN = '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';
const BASE = 'https://resembleai-dramabox.hf.space';
const REF = 'C:/Users/nishqua/Documents/audio_2026-05-24_02-44-42.ogg';
const OUT = 'C:/Users/nishqua/Documents/elysmode/elys_voice.wav';
const TEXT =
  "Hey there, my name is Elys. I'm really happy to see you tonight. Let's have some fun together.";

const auth = { Authorization: `Bearer ${TOKEN}` };

// 1) upload reference
console.log('Uploading reference...');
const refBytes = await readFile(REF);
const form = new FormData();
form.append('files', new Blob([refBytes], { type: 'audio/ogg' }), 'ref.ogg');
const upRes = await fetch(`${BASE}/gradio_api/upload`, {
  method: 'POST',
  headers: auth,
  body: form,
});
if (!upRes.ok) throw new Error(`upload ${upRes.status}: ${await upRes.text()}`);
const upPaths = await upRes.json();
const refPath = upPaths[0];
console.log('ref path:', refPath);

// 2) submit generation
console.log('Submitting generation...');
const submitBody = {
  data: [
    TEXT,
    {
      path: refPath,
      url: null,
      size: null,
      orig_name: 'ref.ogg',
      mime_type: 'audio/ogg',
      is_stream: false,
      meta: { _type: 'gradio.FileData' },
    },
    4.0, // cfg
    3.0, // stg
    1.0, // dur_mult
    0.0, // gen_dur (auto)
    8.0, // ref_dur (8s reference)
    42, // seed
    false, // denoise_ref — у них ModuleNotFoundError когда true, пробуем без
    45.0,
    37.0,
    50.0,
  ],
};
const subRes = await fetch(`${BASE}/gradio_api/call/generate_audio`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify(submitBody),
});
if (!subRes.ok) throw new Error(`submit ${subRes.status}: ${await subRes.text()}`);
const { event_id } = await subRes.json();
console.log('event:', event_id);

// 3) poll SSE для результата
console.log('Polling result...');
const pollRes = await fetch(`${BASE}/gradio_api/call/generate_audio/${event_id}`, {
  headers: auth,
});
if (!pollRes.ok) throw new Error(`poll ${pollRes.status}: ${await pollRes.text()}`);
const sse = await pollRes.text();
console.log('poll body (first 500):', sse.slice(0, 500));
const m = sse.match(/https:\/\/[^"]+\.wav/);
if (!m) throw new Error('no wav url in poll response');
const wavUrl = m[0];
console.log('wav url:', wavUrl);

// 4) download wav
console.log('Downloading wav...');
const wavRes = await fetch(wavUrl, { headers: auth });
if (!wavRes.ok) throw new Error(`wav ${wavRes.status}`);
const buf = Buffer.from(await wavRes.arrayBuffer());
await writeFile(OUT, buf);
console.log(`done: ${OUT} (${buf.length} bytes)`);
