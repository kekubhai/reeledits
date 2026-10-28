// Subtitle utilities: cue normalisation, line-length splitting, SRT/VTT writing and parsing.
import fs from 'node:fs';
import path from 'node:path';
import {ensureDir} from '../_lib/core.mjs';
import {checkSubtitleFile} from '../intake/index.mjs';

const pad = (n, w = 2) => String(n).padStart(w, '0');
const stamp = (s, sep) => {
  const ms = Math.round(s * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
};

// Wraps text to at most `max` chars per line, two lines per cue.
export const wrap = (text, max = 42) => {
  const words = text.split(/\s+/);
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if ((cur + ' ' + w).trim().length > max && cur) lines.push(w);
    else lines[lines.length - 1] = (cur + ' ' + w).trim();
  }
  return lines;
};

// Splits cues whose text needs more than two lines, sharing time by character count.
export const normaliseCues = (cues, max = 42) => {
  const out = [];
  for (const c of [...cues].sort((a, b) => a.from - b.from)) {
    const lines = wrap(c.text, max);
    if (lines.length <= 2) {
      out.push({...c, lines});
      continue;
    }
    const chunks = [];
    for (let i = 0; i < lines.length; i += 2) chunks.push(lines.slice(i, i + 2));
    const total = chunks.reduce((n, l) => n + l.join(' ').length, 0);
    let t = c.from;
    for (const l of chunks) {
      const d = ((c.to - c.from) * l.join(' ').length) / total;
      out.push({from: t, to: t + d, text: l.join(' '), lines: l});
      t += d;
    }
  }
  // Remove overlaps: each cue ends no later than the next one starts.
  for (let i = 0; i < out.length - 1; i++) out[i].to = Math.min(out[i].to, out[i + 1].from);
  return out.filter((c) => c.to - c.from > 0.05);
};

export const writeSubtitles = (cues, base, formats = ['srt', 'vtt'], max = 42) => {
  ensureDir(path.dirname(base));
  const norm = normaliseCues(cues, max);
  const written = [];
  if (formats.includes('srt')) {
    const srt = norm.map((c, i) => `${i + 1}\n${stamp(c.from, ',')} --> ${stamp(c.to, ',')}\n${c.lines.join('\n')}\n`).join('\n');
    fs.writeFileSync(base + '.srt', srt);
    written.push(base + '.srt');
  }
  if (formats.includes('vtt')) {
    const vtt = 'WEBVTT\n\n' + norm.map((c) => `${stamp(c.from, '.')} --> ${stamp(c.to, '.')}\n${c.lines.join('\n')}\n`).join('\n');
    fs.writeFileSync(base + '.vtt', vtt);
    written.push(base + '.vtt');
  }
  return written.map((f) => ({file: f, ...checkSubtitleFile(f)}));
};

// Parses an SRT/VTT file into [{from,to,text}] (for user-supplied subtitles).
export const parseSubtitles = (file) => {
  const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  const t = (s) => {
    const p = s.replace(',', '.').split(':').map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  };
  const cues = [];
  for (const block of text.split(/\n\n+/)) {
    const m = block.match(/([\d:.,]+)\s*-->\s*([\d:.,]+)[^\n]*\n([\s\S]+)/);
    if (m) cues.push({from: t(m[1]), to: t(m[2]), text: m[3].trim().replace(/<[^>]+>/g, '').replace(/\n/g, ' ')});
  }
  return cues;
};
