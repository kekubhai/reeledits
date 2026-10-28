// Speech-to-text with FFmpeg's built-in whisper filter (whisper.cpp). Optional:
// requires a ggml model file, which is NOT downloaded automatically.
import fs from 'node:fs';
import path from 'node:path';
import {STUDIO, ffmpeg, filterPath, run} from '../_lib/core.mjs';
import {parseSubtitles} from '../subtitles/index.mjs';

export const MODEL_DIR = path.join(STUDIO, 'models', 'whisper');

export const findModel = () => {
  if (!fs.existsSync(MODEL_DIR)) return null;
  const f = fs.readdirSync(MODEL_DIR).filter((x) => /^ggml-.*\.bin$/.test(x)).sort();
  return f.length ? path.join(MODEL_DIR, f[0]) : null;
};

export const available = () => {
  const filters = run('ffmpeg', ['-hide_banner', '-filters'], {allowFail: true}).stdout;
  return {filter: /\bwhisper\b/.test(filters), model: findModel()};
};

/** Transcribes `input` to `<outBase>.srt` and returns cues. */
export const transcribe = (input, outBase, {language = 'auto', model} = {}) => {
  const m = model || findModel();
  if (!m) throw new Error(`No whisper model. Place a ggml model (e.g. ggml-base.en.bin from huggingface.co/ggerganov/whisper.cpp) in ${MODEL_DIR}`);
  const srt = outBase + '.srt';
  fs.rmSync(srt, {force: true});
  ffmpeg(['-v', 'error', '-i', input, '-vn', '-af', `aresample=16000,whisper=model='${filterPath(m)}':language=${language}:queue=10:format=srt:destination='${filterPath(srt)}'`, '-f', 'null', '-']);
  return parseSubtitles(srt);
};
