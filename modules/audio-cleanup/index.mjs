// Speech cleanup chain: rumble filter, broadband denoise, mud cut, presence lift, gentle compression.
// Restrained by design: preserves natural speech rather than "radio" processing.
import {ffmpeg} from '../_lib/core.mjs';

export const VOICE_CHAIN = [
  'highpass=f=85',
  'afftdn=nr=12:nf=-30:tn=1',
  'equalizer=f=250:t=q:w=1.2:g=-2',
  'equalizer=f=3200:t=q:w=1.0:g=2.5',
  'acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2',
].join(',');

// Standalone use: clean a file into a new WAV (input is never modified).
export const cleanFile = (input, output) =>
  ffmpeg(['-v', 'error', '-i', input, '-vn', '-af', `${VOICE_CHAIN},aresample=48000`, '-c:a', 'pcm_s16le', output]);
