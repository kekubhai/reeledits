// Asset intake: scan, probe, hash, preview and catalogue files. Never modifies inputs.
import fs from 'node:fs';
import path from 'node:path';
import {STUDIO, describeMedia, ensureDir, ffmpeg, log, readJson, rel, sha256, slug, warn, writeJson} from '../_lib/core.mjs';

const KINDS = {
  video: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'mts', 'm2ts', 'mxf', 'flv', 'wmv', '3gp', 'mpg', 'mpeg'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'aif', 'aiff', 'wma'],
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'heic', 'avif', 'svg'],
  subtitle: ['srt', 'vtt', 'ass', 'ssa'],
  font: ['ttf', 'otf', 'woff', 'woff2'],
  document: ['md', 'txt', 'pdf', 'json', 'csv', 'docx'],
};
const kindOf = (file) => {
  const ext = path.extname(file).slice(1).toLowerCase();
  for (const [k, list] of Object.entries(KINDS)) if (list.includes(ext)) return k;
  return 'other';
};

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    if (e.name.startsWith('.') || e.name.endsWith('.meta.json') || e.name === 'catalog.json' || e.name === 'README.md') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

// Quick subtitle sanity check (SRT/VTT): cue count, ordering, overlaps.
export const checkSubtitleFile = (file) => {
  const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  const re = /(\d{1,2}:)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}):(\d{2})[,.](\d{3})/g;
  const t = (h, m, s, ms) => (h ? parseInt(h) : 0) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
  const cues = [];
  let m;
  while ((m = re.exec(text))) cues.push([t(m[1], m[2], m[3], m[4]), t(m[5], m[6], m[7], m[8])]);
  const problems = [];
  cues.forEach(([a, b], i) => {
    if (b <= a) problems.push(`cue ${i + 1} ends before it starts`);
    if (i && a < cues[i - 1][1] - 0.001) problems.push(`cue ${i + 1} overlaps cue ${i}`);
  });
  if (!cues.length) problems.push('no cues found');
  if (file.toLowerCase().endsWith('.vtt') && !text.startsWith('WEBVTT')) problems.push('missing WEBVTT header');
  return {cues: cues.length, end: cues.length ? cues[cues.length - 1][1] : 0, problems};
};

const compatibility = (kind, ext, media) => {
  const notes = [];
  if (kind === 'video' && media?.video) {
    const v = media.video;
    if (v.vfr) notes.push('variable frame rate: `prepare` converts to constant fps before frame-accurate editing');
    if (['hevc', 'av1', 'prores', 'vp9', 'dnxhd'].includes(v.codec)) notes.push(`${v.codec}: decoded by FFmpeg; Remotion only sees extracted frames`);
    if (v.rotation) notes.push(`rotation metadata ${v.rotation}°: dimensions reported after rotation`);
    if (v.width * v.height > 3840 * 2160) notes.push('larger than 4K: prepare will downscale');
    if (v.height > v.width) notes.push('vertical source');
    if (!media.audio.length) notes.push('no audio stream');
  }
  if (kind === 'video' && !media?.video) notes.push('no decodable video stream');
  if (kind === 'audio' && !media?.audio?.length) notes.push('no decodable audio stream');
  if (kind === 'image' && ['heic', 'avif', 'svg'].includes(ext)) notes.push(`${ext}: may need conversion to PNG before use`);
  if (kind === 'font' && ['woff', 'woff2'].includes(ext)) notes.push('web font: usable in Remotion; FFmpeg text needs TTF/OTF');
  if (kind === 'other') notes.push('unrecognised type: recorded but not used automatically');
  return notes;
};

// Contact sheet (video) or waveform (audio) preview, cached by content hash.
const makePreview = (file, kind, media, previewDir, id, hash) => {
  ensureDir(previewDir);
  const out = path.join(previewDir, `${id}-${hash.slice(0, 8)}.jpg`);
  if (fs.existsSync(out)) return out;
  try {
    if (kind === 'video' && media?.video && media.duration > 0) {
      const n = 12;
      const every = Math.max(media.duration / n, 0.05);
      const tile = media.video.height > media.video.width ? '6x2' : '4x3';
      ffmpeg(['-v', 'error', '-i', file, '-vf', `fps=1/${every},scale=-2:180,tile=${tile}:padding=4:color=0x222222`, '-frames:v', '1', '-q:v', '4', out]);
    } else if (kind === 'audio' || (kind === 'video' && !media?.video && media?.audio?.length)) {
      ffmpeg(['-v', 'error', '-i', file, '-filter_complex', 'aformat=channel_layouts=mono,showwavespic=s=1200x200:colors=0xFED600,format=rgb24,pad=1200:200:0:0:0x111111', '-frames:v', '1', out]);
    } else return null;
    return fs.existsSync(out) ? out : null;
  } catch {
    return null;
  }
};

/**
 * Scans `roots` (absolute dirs) and writes a manifest.
 * @param {{base:string, roots:string[], manifest:string, previews:string, scope:string}} o
 */
export const scan = ({base, roots, manifest, previews, scope}) => {
  const prev = readJson(manifest, {assets: []});
  const prevByPath = new Map(prev.assets.map((a) => [a.path, a]));
  const files = roots.flatMap((r) => walk(r));
  const assets = [];
  const usedIds = new Set();
  let added = 0, changed = 0;

  for (const file of files) {
    const relPath = rel(base, file);
    const st = fs.statSync(file);
    const old = prevByPath.get(relPath);
    const unchanged = old && old.size === st.size && old.mtimeMs === Math.round(st.mtimeMs);
    const ext = path.extname(file).slice(1).toLowerCase();
    const kind = kindOf(file);
    const hash = unchanged ? old.sha256 : sha256(file);
    if (!old) added++;
    else if (!unchanged) changed++;

    let id = old?.id || slug(`${path.basename(path.dirname(file))}-${path.basename(file)}`);
    while (usedIds.has(id)) id += '-x';
    usedIds.add(id);

    const media = unchanged && old.media !== undefined ? old.media : ['video', 'audio', 'image'].includes(kind) ? describeMedia(file) : undefined;
    const sidecar = fs.existsSync(file + '.meta.json') ? JSON.parse(fs.readFileSync(file + '.meta.json', 'utf8')) : {};
    const entry = {
      id,
      path: relPath,
      kind,
      ext,
      size: st.size,
      mtimeMs: Math.round(st.mtimeMs),
      sha256: hash,
      media,
      tags: sidecar.tags || [],
      license: sidecar.license || null,
      notes: sidecar.notes || null,
      compatibility: compatibility(kind, ext, media),
    };
    if (kind === 'subtitle' && ['srt', 'vtt'].includes(ext)) entry.subtitle = checkSubtitleFile(file);
    const pv = makePreview(file, kind, media, previews, id, hash);
    if (pv) entry.preview = rel(base, pv);
    assets.push(entry);
  }

  // Duplicates by content (warn only; nothing is deleted).
  const byHash = new Map();
  for (const a of assets) byHash.set(a.sha256, [...(byHash.get(a.sha256) || []), a.path]);
  const duplicates = [...byHash.values()].filter((l) => l.length > 1);
  const missing = prev.assets.filter((a) => !assets.find((b) => b.path === a.path)).map((a) => a.path);

  const result = {
    scope,
    scannedAt: new Date().toISOString(),
    counts: assets.reduce((o, a) => ((o[a.kind] = (o[a.kind] || 0) + 1), o), {}),
    duplicates,
    missingSinceLastScan: missing,
    assets,
  };
  writeJson(manifest, result);

  log(`Intake (${scope}): ${assets.length} files (${added} new, ${changed} changed, ${missing.length} missing) -> ${rel(STUDIO, manifest)}`);
  for (const a of assets) {
    const m = a.media;
    const spec = m?.video
      ? `${m.video.width}x${m.video.height} ${m.video.fps}fps ${m.video.codec}${m.audio.length ? ` + ${m.audio[0].codec} ${m.audio[0].sampleRate}Hz` : ''} ${m.duration}s`
      : m?.audio?.length
        ? `${m.audio[0].codec} ${m.audio[0].sampleRate}Hz ${m.audio[0].channels}ch ${m.duration}s`
        : a.subtitle
          ? `${a.subtitle.cues} cues`
          : '';
    log(`  ${a.kind.padEnd(8)} ${a.id.padEnd(34)} ${spec}`);
    a.compatibility.forEach((n) => warn(`${a.id}: ${n}`));
    a.subtitle?.problems.forEach((p) => warn(`${a.id}: ${p}`));
  }
  duplicates.forEach((d) => warn(`duplicate content: ${d.join('  ==  ')}`));
  missing.forEach((m) => warn(`no longer present: ${m}`));
  return result;
};

export const intakeProject = (dir) =>
  scan({
    base: dir,
    roots: [path.join(dir, 'input'), path.join(dir, 'assets')],
    manifest: path.join(dir, 'manifest.json'),
    previews: path.join(dir, 'generated', 'intake'),
    scope: path.basename(dir),
  });

export const intakeLibrary = () =>
  scan({
    base: STUDIO,
    roots: [path.join(STUDIO, 'assets')],
    manifest: path.join(STUDIO, 'assets', 'catalog.json'),
    previews: path.join(STUDIO, '.cache', 'catalog-previews'),
    scope: 'library',
  });
