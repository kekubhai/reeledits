// Audio mixing + mastering. Buses: voice, ambient (natural sound), music (ducked under
// voice), sfx. Output: an exact-length 48 kHz stereo WAV, loudness-normalised (two-pass).
import fs from 'node:fs';
import path from 'node:path';
import {ensureDir, ffmpeg, log, warn} from '../_lib/core.mjs';
import {VOICE_CHAIN} from '../audio-cleanup/index.mjs';

const measure = (args, graph) => {
  const r = ffmpeg(['-v', 'info', ...args, '-filter_complex', `${graph},loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json[o]`, '-map', '[o]', '-f', 'null', '-'], {allowFail: true});
  const m = r.stderr.match(/\{[\s\S]*?\}/g);
  return m ? JSON.parse(m[m.length - 1]) : null;
};

/**
 * @param {string} dir project dir (track src paths are relative to it)
 * @param {object} plan {tracks:[{src,at,in,out,gain,role,fadeIn,fadeOut,cleanup}], loudness, truePeak, duck}
 * @param {number} duration seconds
 * @param {string} out wav path
 */
export const mix = (dir, plan, duration, out) => {
  ensureDir(path.dirname(out));
  const tracks = (plan?.tracks || []).filter((t) => t.src);
  const target = plan?.loudness ?? -14;
  const tp = plan?.truePeak ?? -1.5;
  if (!tracks.length) {
    warn('no audio tracks in plan: writing a silent track (set audio.none=true to mean this)');
    ffmpeg(['-v', 'error', '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`, '-t', String(duration), '-c:a', 'pcm_s16le', out]);
    return {silent: true};
  }
  const args = [];
  const chains = [];
  const buses = {voice: [], ambient: [], music: [], sfx: []};
  tracks.forEach((t, i) => {
    const file = path.isAbsolute(t.src) ? t.src : path.join(dir, t.src);
    if (!fs.existsSync(file)) throw new Error(`audio track not found: ${t.src}`);
    args.push('-i', file);
    const role = buses[t.role] ? t.role : 'ambient';
    const f = [];
    if (t.in !== undefined || t.out !== undefined) f.push(`atrim=${t.in ?? 0}${t.out !== undefined ? `:${t.out}` : ''}`, 'asetpts=PTS-STARTPTS');
    f.push('aformat=sample_rates=48000:channel_layouts=stereo');
    if (t.cleanup ?? role === 'voice') f.push(VOICE_CHAIN);
    const len = t.out !== undefined ? t.out - (t.in ?? 0) : null;
    if (t.fadeIn) f.push(`afade=t=in:d=${t.fadeIn}`);
    if (t.fadeOut && len) f.push(`afade=t=out:st=${Math.max(0, len - t.fadeOut)}:d=${t.fadeOut}`);
    const gain = t.gain ?? (role === 'music' ? (tracks.some((x) => x.role === 'voice') ? -12 : -3) : 0);
    f.push(`volume=${gain}dB`);
    const ms = Math.round((t.at ?? 0) * 1000);
    if (ms > 0) f.push(`adelay=${ms}|${ms}`);
    f.push('apad');
    chains.push(`[${i}:a]${f.join(',')}[t${i}]`);
    buses[role].push(`[t${i}]`);
  });
  const bus = (name, list) => {
    if (!list.length) return null;
    if (list.length === 1) {
      chains.push(`${list[0]}anull[${name}]`);
    } else chains.push(`${list.join('')}amix=inputs=${list.length}:normalize=0:duration=longest[${name}]`);
    return `[${name}]`;
  };
  const voice = bus('voice', buses.voice);
  const ambient = bus('ambient', buses.ambient);
  let music = bus('music', buses.music);
  const sfx = bus('sfx', buses.sfx);
  let voiceOut = voice;
  if (music && voice && plan?.duck !== false) {
    chains.push(`${voice}asplit=2[vmain][vkey]`);
    chains.push(`${music}[vkey]sidechaincompress=threshold=0.025:ratio=6:attack=30:release=450:makeup=1[mduck]`);
    voiceOut = '[vmain]';
    music = '[mduck]';
  }
  const outs = [voiceOut, ambient, music, sfx].filter(Boolean);
  const pre = `${chains.join(';')};${outs.join('')}amix=inputs=${outs.length}:normalize=0:duration=longest,atrim=0:${duration},asetpts=PTS-STARTPTS`;

  const m = measure(args, pre);
  const norm = m && Number.isFinite(Number(m.input_i)) && Number(m.input_i) > -70
    ? `loudnorm=I=${target}:TP=${tp}:LRA=11:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`
    : `loudnorm=I=${target}:TP=${tp}:LRA=11`;
  ffmpeg(['-v', 'error', ...args, '-filter_complex', `${pre},${norm},aresample=48000,alimiter=limit=0.89:level=false[out]`, '-map', '[out]', '-c:a', 'pcm_s16le', '-ar', '48000', out]);
  log(`  mix: ${tracks.length} tracks (voice ${buses.voice.length}, ambient ${buses.ambient.length}, music ${buses.music.length}, sfx ${buses.sfx.length}) -> ${target} LUFS`);
  return {silent: false, measuredInput: m?.input_i};
};
