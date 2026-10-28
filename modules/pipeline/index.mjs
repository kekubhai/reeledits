// Orchestrates Prepare -> Produce -> Render -> Validate -> Deliver for one project.
// Production methods:
//   timeline     Remotion engine (library/remotion) driven by timeline.json
//   ffmpeg-edit  FFmpeg-only cut list (edit.json): vlogs, montages, quick social cuts
//   custom       project's own commands (project.json production.custom.steps)
import fs from 'node:fs';
import path from 'node:path';
import {STUDIO, describeMedia, ensureDir, exists, hashOf, log, readJson, rel, run, warn, writeJson} from '../_lib/core.mjs';
import {prepareMedia} from '../prepare/index.mjs';
import {synthMusic, synthSfx} from '../music-synth/index.mjs';
import {mix} from '../mix/index.mjs';
import {renderComposition} from '../remotion-render/index.mjs';
import {renderEdit} from '../ffmpeg-edit/index.mjs';
import {encode, preview, thumbnail} from '../deliver/index.mjs';
import {writeSubtitles, parseSubtitles} from '../subtitles/index.mjs';
import {validateVideo, writeReport} from '../validate/index.mjs';
import {narrate, available as ttsAvailable} from '../tts-windows/index.mjs';

// ---------- narration (optional, timeline + ffmpeg-edit) ----------
const ensureNarration = (dir, spec) => {
  if (!spec?.lines?.length) return null;
  const outDir = path.join(dir, 'generated', 'narration');
  const stampFile = path.join(outDir, '.spec.json');
  const key = hashOf(spec);
  if (exists(stampFile) && readJson(stampFile).key === key && exists(path.join(outDir, 'narration.json'))) return readJson(path.join(outDir, 'narration.json'));
  if (spec.engine && spec.engine !== 'windows-tts') throw new Error(`Narration engine "${spec.engine}" not available. Supply recorded audio instead (audio.tracks with role "voice").`);
  if (!ttsAvailable()) throw new Error('Narration requested but Windows TTS is unavailable on this machine. Record the narration and add it as a voice track.');
  log(`  narration: ${spec.lines.length} lines via Windows TTS (${spec.voice || 'default voice'})`);
  fs.rmSync(outDir, {recursive: true, force: true});
  const n = narrate({...spec, outDir});
  writeJson(stampFile, {key});
  return n;
};

// Scenes may end on a narration cue: {untilCue: n, pad: 0.6} instead of a fixed duration.
const timeScenes = (scenes, narration) => {
  let t = 0;
  return scenes.map((s) => {
    const from = s.at ?? t;
    let duration = s.duration;
    if (s.untilCue !== undefined) {
      const cue = narration?.cues?.[s.untilCue];
      if (!cue) throw new Error(`scene ${s.id || s.type}: untilCue ${s.untilCue} but narration has ${narration?.cues?.length || 0} cues`);
      duration = cue.to + (s.pad ?? 0.6) - from;
    }
    if (!(duration > 0)) throw new Error(`scene ${s.id || s.type}: needs a positive duration`);
    t = from + duration;
    const {untilCue, pad, ...rest} = s;
    return {...rest, at: from, duration: +duration.toFixed(3)};
  });
};

const resolveCaptions = (dir, spec, narration) => {
  if (!spec) return [];
  if (spec === 'narration') return (narration?.cues || []).map(({from, to, text}) => ({from, to, text}));
  if (Array.isArray(spec)) return spec;
  if (spec.file) return parseSubtitles(path.join(dir, spec.file)).map((c) => ({...c, from: c.from + (spec.offset || 0), to: c.to + (spec.offset || 0)}));
  return [];
};

// ---------- audio (shared by timeline + ffmpeg-edit) ----------
const buildAudio = (dir, audio = {}, duration, narration, extraTracks = []) => {
  const gen = ensureDir(path.join(dir, 'generated', 'audio'));
  const tracks = [...extraTracks, ...(audio.tracks || [])];
  if (narration) for (const c of narration.cues) tracks.push({src: rel(dir, path.join(dir, 'generated', 'narration', c.file)), at: c.from, role: 'voice', cleanup: false, gain: audio.narrationGain ?? 0});
  if (audio.music) {
    let src = audio.music.src;
    if (audio.music.synth) {
      src = 'generated/audio/music.wav';
      synthMusic({...audio.music.synth, duration, out: path.join(dir, src)});
    }
    tracks.push({src, at: audio.music.at || 0, role: 'music', gain: audio.music.gain, in: audio.music.in, out: audio.music.out, fadeOut: audio.music.fadeOut});
  }
  if (audio.sfx?.length) {
    synthSfx({duration, events: audio.sfx, out: path.join(gen, 'sfx.wav')});
    tracks.push({src: 'generated/audio/sfx.wav', role: 'sfx', gain: audio.sfxGain ?? -3});
  }
  if (audio.none) return null;
  const out = path.join(gen, 'mix.wav');
  mix(dir, {...audio, tracks}, duration, out);
  return out;
};

// ---------- deliverables + validation ----------
const finish = (ctx, {master, duration, cues, quality}) => {
  const {dir, project, name} = ctx;
  const outDir = ensureDir(path.join(dir, 'output'));
  const o = project.output || {};
  const deliver = [];
  let subs = [];
  if (cues?.length && (o.subtitles ?? ['srt', 'vtt']).length) {
    subs = writeSubtitles(cues, path.join(outDir, quality === 'draft' ? `${name}-draft` : name), o.subtitles ?? ['srt', 'vtt'], o.subtitleLineLength || 42);
    subs.forEach((s) => deliver.push(rel(dir, s.file)));
  }
  if (quality === 'final') {
    const portrait = (o.height || 1080) > (o.width || 1920);
    deliver.push(rel(dir, preview(master, path.join(outDir, `${name}-preview.mp4`), {portrait})));
    const thumb = thumbnail(master, path.join(outDir, `${name}-thumbnail.jpg`), o.thumbnailAt ?? Math.min(duration * 0.35, duration - 0.1));
    if (thumb) deliver.push(rel(dir, thumb));
  }
  const report = validateVideo(
    master,
    {width: Math.round((o.width || 1920) * (quality === 'draft' ? 0.5 : 1) / 2) * 2, height: Math.round((o.height || 1080) * (quality === 'draft' ? 0.5 : 1) / 2) * 2, fps: o.fps || 30, duration, audio: !(ctx.audioNone), loudness: o.loudness ?? -14},
    {reviewDir: path.join(dir, 'renders', 'review'), subtitles: subs.map((s) => s.file)},
  );
  const summary = writeReport(report, path.join(outDir, quality === 'draft' ? 'validation-draft.json' : 'validation.json'));
  log('\n' + summary);
  log(`\nMaster:  ${rel(STUDIO, master)}`);
  deliver.forEach((d) => log(`Also:    ${rel(STUDIO, path.join(dir, d))}`));
  if (report.sheet) log(`Review:  ${rel(STUDIO, report.sheet)}  <- look at this before calling it done`);
  log(report.ok ? '\nValidation: PASS (technical). Visual review still required.' : '\nValidation: FAIL, see above.');
  return report;
};

// ---------- methods ----------
const renderTimeline = (ctx, quality) => {
  const {dir, project, name} = ctx;
  const draft = quality === 'draft';
  const src = readJson(path.join(dir, project.production?.timeline || 'timeline.json'));
  const o = project.output || {};
  const tl = {...src, width: src.width || o.width || 1920, height: src.height || o.height || 1080, fps: src.fps || o.fps || 30};
  log(`Stage C/D: prepare + produce (${draft ? 'draft' : 'final'})`);
  const narration = ensureNarration(dir, tl.narration);
  const scenes = timeScenes(tl.scenes, narration);
  const duration = +Math.max(...scenes.map((s) => s.at + s.duration)).toFixed(3);
  const media = prepareMedia(dir, tl, {draft});
  // Project fonts (assets/fonts) are copied into the public dir for Remotion.
  const fonts = (tl.fonts || []).map((f) => {
    const dst = path.join(dir, 'generated', 'public', 'fonts', path.basename(f.src));
    ensureDir(path.dirname(dst));
    fs.copyFileSync(path.join(dir, f.src), dst);
    return {...f, src: `fonts/${path.basename(f.src)}`};
  });
  const cues = resolveCaptions(dir, tl.overlays?.captions, narration);
  const props = {width: tl.width, height: tl.height, fps: tl.fps, theme: tl.theme, media, scenes, fonts, overlays: {...(tl.overlays || {}), captions: tl.overlays?.burnCaptions === false ? [] : cues}};
  const propsFile = path.join(dir, 'generated', 'timeline.resolved.json');
  writeJson(propsFile, props);

  ctx.audioNone = !!tl.audio?.none;
  const audio = buildAudio(dir, tl.audio, duration, narration);
  log('Stage E: render');
  const video = renderComposition({out: path.join(dir, 'renders', draft ? 'video-draft.mp4' : 'video.mp4'), publicDir: path.join(dir, 'generated', 'public'), props: propsFile, draft});
  const master = path.join(dir, 'output', draft ? `${name}-draft.mp4` : `${name}.mp4`);
  encode(video, audio, master, {quality, duration, fullRangeInput: true});
  log('Stage F/G: validate + deliver');
  return finish(ctx, {master, duration, cues, quality});
};

const renderFfmpegEdit = (ctx, quality) => {
  const {dir, project, name} = ctx;
  const draft = quality === 'draft';
  const edl = readJson(path.join(dir, project.production?.edit || 'edit.json'));
  const o = project.output || {};
  edl.width ||= o.width || 1920;
  edl.height ||= o.height || 1080;
  edl.fps ||= o.fps || 30;
  log(`Stage D: FFmpeg edit (${draft ? 'draft' : 'final'})`);
  const narration = ensureNarration(dir, edl.narration);
  const cues = resolveCaptions(dir, edl.captions, narration);
  const {duration, file} = renderEdit(dir, {...edl, captions: edl.burnCaptions === false ? [] : cues}, path.join(dir, 'renders', draft ? 'edit-draft.mov' : 'edit.mov'), {draft});
  ctx.audioNone = !!edl.audio?.none;
  const natural = edl.audio?.natural === false ? [] : [{src: rel(dir, file), role: edl.audio?.naturalRole || 'ambient', gain: edl.audio?.naturalGain ?? 0, cleanup: edl.audio?.cleanup ?? false}];
  const audio = buildAudio(dir, edl.audio, duration, narration, natural);
  const master = path.join(dir, 'output', draft ? `${name}-draft.mp4` : `${name}.mp4`);
  encode(file, audio, master, {quality, duration});
  log('Stage F/G: validate + deliver');
  return finish(ctx, {master, duration, cues, quality});
};

const renderCustom = (ctx, quality, opts) => {
  const {dir, project} = ctx;
  const c = project.production?.custom || {};
  for (const step of c.steps || []) {
    const s = Array.isArray(step) ? {run: step} : step;
    if (s.skipIfExists && exists(path.join(dir, s.skipIfExists)) && !opts.force) {
      log(`  skip (exists): ${s.run.join(' ')}`);
      continue;
    }
    log(`  $ ${s.run.join(' ')}`);
    const [cmd, ...args] = s.run.map((a) => a.replace('{STUDIO}', STUDIO).replace('{PROJECT}', dir).replace('{QUALITY}', quality));
    run(cmd === 'node' ? process.execPath : cmd, args, {cwd: dir, quiet: false});
  }
  const master = path.join(dir, c.master);
  const o = project.output || {};
  const report = validateVideo(master, {width: o.width, height: o.height, fps: o.fps, duration: c.duration, loudness: o.loudness}, {reviewDir: path.join(dir, 'renders', 'review'), subtitles: (c.subtitles || []).map((s) => path.join(dir, s))});
  log('\n' + writeReport(report, path.join(dir, 'output', 'validation.json')));
  if (report.sheet) log(`Review:  ${rel(STUDIO, report.sheet)}`);
  return report;
};

export const renderProject = (ctx, {quality = 'final', force = false} = {}) => {
  const method = ctx.project.production?.method || 'timeline';
  log(`\n== ${ctx.name} :: ${method} :: ${quality}`);
  if (method === 'timeline') return renderTimeline(ctx, quality);
  if (method === 'ffmpeg-edit') return renderFfmpegEdit(ctx, quality);
  if (method === 'custom') return renderCustom(ctx, quality, {force});
  throw new Error(`Unknown production method "${method}" (timeline | ffmpeg-edit | custom)`);
};

export const validateProject = (ctx, file) => {
  const {dir, project, name} = ctx;
  const o = project.output || {};
  const master = file ? path.resolve(file) : path.join(dir, 'output', project.production?.custom?.master ? path.basename(project.production.custom.master) : `${name}.mp4`);
  const subs = ['srt', 'vtt'].map((e) => path.join(dir, 'output', `${name}.${e}`)).filter(exists);
  const r = validateVideo(master, {width: o.width, height: o.height, fps: o.fps, loudness: o.loudness}, {reviewDir: path.join(dir, 'renders', 'review'), subtitles: subs});
  log(writeReport(r, path.join(dir, 'output', 'validation.json')));
  if (r.sheet) log(`Review: ${rel(STUDIO, r.sheet)}`);
  return r;
};
