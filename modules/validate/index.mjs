// Technical validation of a rendered video + a contact sheet for visual review.
// A passing report is necessary but not sufficient: an agent must still LOOK at the sheet.
import fs from 'node:fs';
import path from 'node:path';
import {describeMedia, ensureDir, ffmpeg, writeJson} from '../_lib/core.mjs';
import {checkSubtitleFile} from '../intake/index.mjs';

const near = (a, b, tol) => Math.abs(a - b) <= tol;

export const validateVideo = (file, expect = {}, {reviewDir, subtitles = [], sheetFrames = 15} = {}) => {
  const checks = [];
  const add = (name, ok, detail, level = 'error') => checks.push({name, ok, level: ok ? 'ok' : level, detail});

  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    add('output exists', false, file);
    return {ok: false, checks};
  }
  add('output exists', true, `${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
  const m = describeMedia(file);
  const v = m?.video;
  add('video stream', !!v, v ? `${v.codec} ${v.width}x${v.height} ${v.fps}fps ${v.pixFmt}` : 'missing');
  if (v) {
    if (expect.width) add('resolution', v.width === expect.width && v.height === expect.height, `${v.width}x${v.height} (expected ${expect.width}x${expect.height})`);
    if (expect.fps) add('frame rate', near(v.fps, expect.fps, 0.01), `${v.fps} (expected ${expect.fps})`);
    add('pixel format', v.pixFmt === 'yuv420p', v.pixFmt, 'warn');
  }
  if (expect.duration) add('duration', near(m.duration, expect.duration, 0.15), `${m.duration}s (expected ${expect.duration}s)`);

  const wantAudio = expect.audio !== false;
  const a = m?.audio?.[0];
  add('audio stream', wantAudio ? !!a : true, a ? `${a.codec} ${a.sampleRate}Hz ${a.channels}ch` : 'none');

  // Silence / truncation / loudness.
  if (a) {
    const vd = ffmpeg(['-v', 'info', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], {allowFail: true}).stderr;
    const mean = Number(vd.match(/mean_volume: ([-\d.]+)/)?.[1] ?? -99);
    const max = Number(vd.match(/max_volume: ([-\d.]+)/)?.[1] ?? -99);
    add('audio not silent', mean > -60, `mean ${mean} dB, max ${max} dB`);
    add('no clipping', max < -0.1, `max ${max} dB`, 'warn');
    const eb = ffmpeg(['-v', 'info', '-i', file, '-vn', '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], {allowFail: true}).stderr;
    const I = Number(eb.match(/I:\s+([-\d.]+) LUFS/g)?.pop()?.match(/[-\d.]+/)?.[0]);
    if (Number.isFinite(I)) add('loudness', expect.loudness === undefined || near(I, expect.loudness, 1.5), `${I} LUFS${expect.loudness !== undefined ? ` (target ${expect.loudness})` : ''}`, 'warn');
    // Tail: is there still sound in the last second? (abrupt-cut / truncation hint)
    const tail = ffmpeg(['-v', 'info', '-sseof', '-0.3', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], {allowFail: true}).stderr;
    const tailMean = Number(tail.match(/mean_volume: ([-\d.]+)/)?.[1] ?? -99);
    add('audio resolves at end', tailMean < -30, `last 0.3 s mean ${tailMean} dB`, 'warn');
  }

  // Black / frozen segments (reported; may be intentional, e.g. text on black).
  const det = ffmpeg(['-v', 'info', '-i', file, '-an', '-vf', 'blackdetect=d=0.5:pix_th=0.05,freezedetect=n=0.002:d=2', '-f', 'null', '-'], {allowFail: true}).stderr;
  const blacks = [...det.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((x) => [+x[1], +x[2]]);
  const freezes = [...det.matchAll(/freeze_start: ([\d.]+)[\s\S]*?freeze_duration: ([\d.]+)/g)].map((x) => [+x[1], +(+x[1] + +x[2]).toFixed(2)]);
  add('black segments', blacks.length === 0, blacks.length ? blacks.map((b) => `${b[0]}-${b[1]}s`).join(', ') : 'none', 'warn');
  add('frozen segments (>2s)', freezes.length === 0, freezes.length ? freezes.map((b) => `${b[0]}-${b[1]}s`).join(', ') : 'none', 'warn');

  for (const s of subtitles) {
    if (!fs.existsSync(s)) continue;
    const c = checkSubtitleFile(s);
    add(`subtitles ${path.basename(s)}`, c.problems.length === 0 && (!m.duration || c.end <= m.duration + 0.1), `${c.cues} cues, ends ${c.end.toFixed(2)}s${c.problems.length ? '; ' + c.problems.join('; ') : ''}`);
  }

  // Contact sheet for the mandatory visual review.
  let sheet = null;
  const times = [];
  if (reviewDir && v && m.duration > 0) {
    ensureDir(reviewDir);
    sheet = path.join(reviewDir, `${path.basename(file, path.extname(file))}-sheet.jpg`);
    const n = sheetFrames;
    const cols = v.height > v.width ? 5 : 3;
    for (let i = 0; i < n; i++) times.push(+((m.duration * (i + 0.5)) / n).toFixed(2));
    const scale = v.height > v.width ? 'scale=-2:480' : 'scale=640:-2';
    ffmpeg(['-v', 'error', '-i', file, '-vf', `fps=${n}/${m.duration},${scale},tile=${cols}x${Math.ceil(n / cols)}:padding=6:color=0x444444`, '-frames:v', '1', '-q:v', '3', sheet], {allowFail: true});
  }
  const ok = checks.every((c) => c.ok || c.level === 'warn');
  return {ok, file, media: m, checks, blacks, freezes, sheet, sheetTimes: times};
};

export const writeReport = (report, out) => {
  writeJson(out, report);
  const lines = report.checks.map((c) => `${c.ok ? 'PASS' : c.level === 'warn' ? 'WARN' : 'FAIL'}  ${c.name.padEnd(26)} ${c.detail}`);
  return lines.join('\n');
};
