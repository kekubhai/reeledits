// Shared helpers for Studio modules: paths, JSON, process execution, media probing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROJECTS = path.join(STUDIO, 'projects', 'videos');
export const CACHE = path.join(STUDIO, '.cache');

// Keep every temp/cache write on the Studio drive (the system drive may be full).
export const setupEnv = () => {
  const tmp = path.join(CACHE, 'tmp');
  fs.mkdirSync(tmp, {recursive: true});
  process.env.TEMP = tmp;
  process.env.TMP = tmp;
  process.env.TMPDIR = tmp;
  process.env.npm_config_cache = path.join(CACHE, 'npm');
};

// ---------- files ----------
export const ensureDir = (d) => (fs.mkdirSync(d, {recursive: true}), d);
export const exists = (p) => fs.existsSync(p);
export const readJson = (p, fallback) => {
  if (!fs.existsSync(p)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing file: ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};
export const writeJson = (p, data) => {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
};
export const posix = (p) => p.split(path.sep).join('/');
export const rel = (from, to) => posix(path.relative(from, to));

export const sha256 = (file) => {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(1 << 20);
  let n;
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  fs.closeSync(fd);
  return h.digest('hex');
};
export const hashOf = (obj) => crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 12);

export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'asset';

// ---------- projects ----------
export const projectDir = (name) => {
  if (!name) throw new Error('Project name required (see `node studio.mjs list`).');
  const direct = path.resolve(name);
  if (fs.existsSync(path.join(direct, 'project.json'))) return direct;
  const p = path.join(PROJECTS, name);
  if (!fs.existsSync(path.join(p, 'project.json'))) throw new Error(`No project "${name}" in ${PROJECTS}`);
  return p;
};
export const loadProject = (name) => {
  const dir = projectDir(name);
  const project = readJson(path.join(dir, 'project.json'));
  return {dir, project, name: path.basename(dir)};
};

// ---------- processes ----------
export const run = (cmd, args, {cwd, quiet = true, allowFail = false, input} = {}) => {
  const r = spawnSync(cmd, args, {cwd, encoding: 'utf8', maxBuffer: 1 << 28, input, windowsHide: true});
  if (r.error) {
    if (allowFail) return {ok: false, stdout: '', stderr: String(r.error), status: -1};
    throw new Error(`Failed to start ${cmd}: ${r.error.message}`);
  }
  const ok = r.status === 0;
  if (!ok && !allowFail) {
    const tail = (r.stderr || '').trim().split('\n').slice(-12).join('\n');
    throw new Error(`${cmd} exited with ${r.status}\n${tail}`);
  }
  if (!quiet && r.stdout) process.stdout.write(r.stdout);
  return {ok, stdout: r.stdout || '', stderr: r.stderr || '', status: r.status};
};

export const ffmpeg = (args, opts = {}) => run('ffmpeg', ['-hide_banner', '-y', ...args], opts);

export const has = (cmd, args = ['-version']) => run(cmd, args, {allowFail: true}).ok;

export const ffprobe = (file) => {
  const r = run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], {
    allowFail: true,
  });
  if (!r.ok) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
};

const ratio = (s) => {
  if (!s || s === '0/0') return 0;
  const [a, b] = s.split('/').map(Number);
  return b ? a / b : a;
};

// Condensed, tool-agnostic description of a media file.
export const describeMedia = (file) => {
  const p = ffprobe(file);
  if (!p) return null;
  const v = p.streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const audio = p.streams.filter((s) => s.codec_type === 'audio');
  const subs = p.streams.filter((s) => s.codec_type === 'subtitle');
  const duration = Number(p.format?.duration || v?.duration || audio[0]?.duration || 0);
  let video = null;
  if (v) {
    const rotation =
      Number(v.tags?.rotate || 0) || Number(v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation || 0);
    const rFps = ratio(v.r_frame_rate);
    const avgFps = ratio(v.avg_frame_rate);
    let w = v.width, h = v.height;
    if (Math.abs(rotation) % 180 === 90) [w, h] = [h, w];
    video = {
      codec: v.codec_name,
      width: w,
      height: h,
      rotation,
      fps: Math.round((avgFps || rFps) * 1000) / 1000,
      vfr: rFps > 0 && avgFps > 0 && Math.abs(rFps - avgFps) / rFps > 0.02,
      pixFmt: v.pix_fmt,
      frames: Number(v.nb_frames || 0) || undefined,
      still: (p.format?.format_name || '').includes('image2') || (v.codec_name && ['png', 'mjpeg', 'webp', 'bmp', 'gif', 'tiff'].includes(v.codec_name) && duration < 0.1),
    };
  }
  return {
    container: p.format?.format_name,
    duration: Math.round(duration * 1000) / 1000,
    bitrate: Number(p.format?.bit_rate || 0) || undefined,
    video,
    audio: audio.map((a) => ({
      codec: a.codec_name,
      sampleRate: Number(a.sample_rate),
      channels: a.channels,
      layout: a.channel_layout,
    })),
    subtitleStreams: subs.length,
  };
};

// ---------- misc ----------
export const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
};
export const log = (...a) => console.log(...a);
export const warn = (...a) => console.log('  ! ', ...a);

// Escapes a path for use inside an FFmpeg filter argument (drawtext fontfile, etc.).
export const filterPath = (p) => posix(p).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

// First TTF/OTF font available: Studio assets first, then the OS (FFmpeg drawtext cannot read WOFF).
export const findTtf = (preferDir) => {
  const dirs = [preferDir, path.join(STUDIO, 'assets', 'fonts')].filter(Boolean);
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    const f = fs.readdirSync(d).find((x) => /\.(ttf|otf)$/i.test(x));
    if (f) return path.join(d, f);
  }
  for (const f of ['C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']) {
    if (fs.existsSync(f)) return f;
  }
  return null;
};
