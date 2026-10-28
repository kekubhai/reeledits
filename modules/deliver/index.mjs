// Final encode/mux, preview and thumbnail. Encodes to broadcast-safe H.264 yuv420p
// (TV range, BT.709) + AAC 48 kHz, with faststart for web playback.
import fs from 'node:fs';
import path from 'node:path';
import {ensureDir, ffmpeg} from '../_lib/core.mjs';

export const QUALITY = {
  draft: {crf: 26, preset: 'veryfast', audio: '160k'},
  final: {crf: 17, preset: 'slow', audio: '320k'},
};

/**
 * @param {string} video silent or audio-bearing video
 * @param {string|null} audio WAV to use as the soundtrack (null = keep video's own audio, or none)
 * @param {string} out mp4 path
 */
export const encode = (video, audio, out, {quality = 'final', duration, fullRangeInput = false} = {}) => {
  const q = QUALITY[quality];
  ensureDir(path.dirname(out));
  const args = ['-v', 'error', '-i', video];
  if (audio) args.push('-i', audio);
  const range = fullRangeInput ? 'scale=in_range=full:out_range=tv,' : '';
  args.push('-map', '0:v:0');
  if (audio) args.push('-map', '1:a:0');
  else args.push('-map', '0:a:0?');
  args.push(
    '-vf', `${range}format=yuv420p`,
    '-c:v', 'libx264', '-crf', String(q.crf), '-preset', q.preset, '-profile:v', 'high', '-threads', '4',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:a', 'aac', '-b:a', q.audio, '-ar', '48000', '-ac', '2',
  );
  if (duration) args.push('-t', String(duration));
  args.push('-movflags', '+faststart', out);
  ffmpeg(args);
  return out;
};

export const preview = (master, out, {portrait = false} = {}) => {
  ffmpeg(['-v', 'error', '-i', master, '-vf', portrait ? 'scale=-2:1280:flags=lanczos' : 'scale=1280:-2:flags=lanczos', '-c:v', 'libx264', '-crf', '25', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
  return out;
};

export const thumbnail = (video, out, at = 1) => {
  ffmpeg(['-v', 'error', '-ss', String(at), '-i', video, '-frames:v', '1', '-q:v', '2', out]);
  return fs.existsSync(out) ? out : null;
};
