// Original, dependency-free music bed + sound-effect synthesis (no samples, no licensing risk).
import fs from 'node:fs';
import path from 'node:path';
import {ensureDir} from '../_lib/core.mjs';

const SR = 48000;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => ((x = clamp01(x)), x * x * (3 - 2 * x));

export const PROGRESSIONS = {
  bright: [[38, [50, 57, 61, 66, 69]], [35, [47, 54, 57, 62, 66]], [31, [43, 50, 54, 59, 62]], [33, [45, 52, 57, 59, 64]]],
  calm: [[36, [48, 55, 59, 64, 67]], [33, [45, 52, 55, 60, 64]], [29, [41, 48, 52, 57, 60]], [31, [43, 50, 55, 59, 64]]],
  driving: [[33, [45, 52, 57, 60, 64]], [29, [41, 48, 53, 57, 60]], [36, [48, 55, 60, 64, 67]], [31, [43, 50, 55, 59, 62]]],
  warm: [[29, [41, 48, 52, 57, 64]], [28, [40, 47, 50, 55, 62]], [26, [38, 45, 48, 53, 60]], [24, [36, 43, 47, 52, 59]]],
};

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), (seed / 4294967296) * 2 - 1);

const writeWav = (file, L, R, peakDb) => {
  const N = L.length;
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const gain = peak > 0 ? Math.pow(10, peakDb / 20) / peak : 1;
  const data = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, Buffer.concat([h, data]));
};

const addAt = (L, R, t0, s, pl = 1, pr = 1) => {
  const i0 = Math.round(t0 * SR);
  for (let i = 0; i < s.length; i++) {
    const j = i0 + i;
    if (j >= 0 && j < L.length) (L[j] += s[i] * pl), (R[j] += s[i] * pr);
  }
};

const reverb = (L, R, mix) => {
  for (const [ch, x] of [[0, L], [1, R]]) {
    const combs = [1557, 1617, 1491, 1422].map((d) => ({b: new Float32Array(d + ch * 23), i: 0}));
    const aps = [225, 556].map((d) => ({b: new Float32Array(d), i: 0}));
    for (let i = 0; i < x.length; i++) {
      let y = 0;
      for (const c of combs) {
        const o = c.b[c.i];
        c.b[c.i] = x[i] * 0.5 + o * 0.84;
        c.i = (c.i + 1) % c.b.length;
        y += o;
      }
      y *= 0.25;
      for (const a of aps) {
        const o = a.b[a.i];
        const v = y + o * 0.5;
        a.b[a.i] = v;
        a.i = (a.i + 1) % a.b.length;
        y = o - v * 0.5;
      }
      x[i] += y * mix;
    }
  }
};

/**
 * @param {object} o
 * @param {number} o.duration seconds
 * @param {number} [o.bpm=100]
 * @param {string|Array} [o.progression='bright'] preset name or [[rootMidi,[notes]]...] one chord per bar
 * @param {Array} [o.sections] [{from,to,level=1,bass=false,groove=false,arp=false}] energy per time range
 * @param {number} [o.resolveAt] time after which the tonic chord is held (closing)
 * @param {number} [o.fadeOut=2.4] seconds
 * @param {string} o.out output wav path
 */
export const synthMusic = ({duration, bpm = 100, progression = 'bright', sections, resolveAt, fadeOut = 2.4, out}) => {
  const prog = typeof progression === 'string' ? PROGRESSIONS[progression] : progression;
  if (!prog) throw new Error(`Unknown progression "${progression}". Options: ${Object.keys(PROGRESSIONS).join(', ')}`);
  const secs = sections?.length ? sections : [{from: 0, to: duration, level: 1}];
  const secAt = (t) => secs.find((s) => t >= s.from && t < s.to) || {level: 0};
  const N = Math.ceil(duration * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  const BEAT = 60 / bpm, BAR = BEAT * 4;
  const chordAt = (t) => (resolveAt !== undefined && t >= resolveAt ? prog[0] : prog[Math.floor(t / BAR) % prog.length]);

  // pad
  const phase = new Map();
  const pans = [[1, 0.55], [0.8, 0.8], [0.55, 1]];
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const bar = Math.floor(t / BAR), inBar = t - bar * BAR;
    const resolved = resolveAt !== undefined && t >= resolveAt;
    const cur = chordAt(t), prev = resolved ? prog[0] : prog[(bar + prog.length - 1) % prog.length];
    const xf = resolved ? 1 : smooth(inBar / 0.5);
    let l = 0, r = 0;
    const render = (chord, w, tag) =>
      chord[1].forEach((m, k) =>
        [-6, 0, 6].forEach((c, v) => {
          const key = `${tag}${m}-${v}`;
          let p = phase.get(key) ?? k * 0.7 + v * 1.3;
          p += (2 * Math.PI * mtof(m) * Math.pow(2, c / 1200)) / SR;
          phase.set(key, p);
          const s = Math.sin(p) + 0.22 * Math.sin(2 * p) + 0.08 * Math.sin(3 * p);
          const a = w * 0.022 * (k === 0 ? 1.2 : 1);
          (l += s * a * pans[v][0]), (r += s * a * pans[v][1]);
        }),
      );
    render(cur, xf, 'a');
    if (xf < 1) render(prev, 1 - xf, 'b');
    const g = 0.85 + 0.15 * Math.sin((2 * Math.PI * t) / (BAR * 2));
    (L[i] += l * g), (R[i] += r * g);
  }
  // bass
  let bp = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const s = secAt(t);
    if (!s.bass && !s.groove) continue;
    const inBar = t % BAR;
    bp += (2 * Math.PI * mtof(chordAt(t)[0] + 12)) / SR;
    const env = Math.min(1, inBar / 0.02) * (0.6 + 0.4 * Math.exp(-inBar * 1.5));
    const v = Math.tanh(1.6 * Math.sin(bp)) * 0.11 * env * (s.groove ? 1 : 0.55);
    (L[i] += v), (R[i] += v);
  }
  // drums
  const kick = Float32Array.from({length: Math.round(0.45 * SR)}, (_, i) => {
    const t = i / SR;
    return Math.sin(2 * Math.PI * (48 * t + (90 / 32) * (1 - Math.exp(-t * 32)))) * Math.exp(-t * 7.5) * 0.42;
  });
  let last = 0;
  const hat = Float32Array.from({length: Math.round(0.06 * SR)}, (_, i) => {
    const n = rnd(), hp = n - last;
    last = n;
    return hp * Math.exp((-i / SR) * 70) * 0.05;
  });
  for (let b = 0; b * BEAT < duration; b++) {
    const t = b * BEAT;
    if (!secAt(t).groove) continue;
    if (b % 2 === 0) addAt(L, R, t, kick);
    addAt(L, R, t + BEAT / 2, hat, 0.7, 1);
  }
  // arp
  const pattern = [0, 2, 1, 3, 2, 4, 3, 1];
  for (let k = 0; k * (BEAT / 2) < duration; k++) {
    const t = k * (BEAT / 2);
    if (!secAt(t).arp) continue;
    const f = mtof(chordAt(t)[1][pattern[k % 8]] + 12);
    const n = Math.round(0.5 * SR);
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const tt = i / SR, p = 2 * Math.PI * f * tt;
      s[i] = (Math.sin(p) + 0.35 * Math.sin(2 * p) * Math.exp(-tt * 18)) * Math.exp(-tt * 7) * Math.min(1, tt / 0.003) * 0.05;
    }
    addAt(L, R, t, s, k % 2 ? 0.65 : 1, k % 2 ? 1 : 0.65);
  }
  reverb(L, R, 0.35);
  // section levels (smoothed) + fades
  let g = secAt(0).level ?? 1;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const target = secAt(t).level ?? 1;
    g += (target - g) * 0.0002; // ~100 ms glide
    const f = Math.min(1, t / 0.5) * (1 - smooth((t - (duration - fadeOut)) / fadeOut));
    (L[i] *= g * f), (R[i] *= g * f);
  }
  writeWav(out, L, R, -3);
  return out;
};

const tick = (f = 2400) => {
  let p = 0;
  return Float32Array.from({length: Math.round(0.08 * SR)}, (_, i) => {
    p += (2 * Math.PI * f) / SR;
    return (Math.sin(p) * 0.6 + rnd() * 0.25) * Math.exp((-i / SR) * 60) * 0.22;
  });
};
const whoosh = (len = 0.55, level = 0.16) => {
  const n = Math.round(len * SR);
  let lp = 0;
  return Float32Array.from({length: n}, (_, i) => {
    const x = i / n;
    lp += (0.02 + 0.25 * x) * (rnd() - lp);
    return lp * Math.sin(Math.PI * Math.pow(x, 0.8)) ** 2 * level * 3;
  });
};
const impact = (level = 1) => {
  let p = 0, lp = 0;
  return Float32Array.from({length: Math.round(2.2 * SR)}, (_, i) => {
    const t = i / SR;
    p += (2 * Math.PI * (34 + 40 * Math.exp(-t * 9))) / SR;
    lp += 0.06 * (rnd() - lp);
    return (Math.sin(p) * 0.55 * Math.exp(-t * 2.4) + lp * 1.2 * Math.exp(-t * 10)) * level;
  });
};
const shimmer = (notes = [74, 78, 81, 85], level = 0.045, len = 2.6) => {
  const n = Math.round(len * SR);
  const out = new Float32Array(n);
  notes.forEach((m, k) => {
    const f = mtof(m);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      out[i] += Math.sin(2 * Math.PI * f * t + k) * Math.exp(-t * 1.6) * Math.min(1, t / (0.02 + k * 0.03)) * level;
    }
  });
  return out;
};
const pop = () => {
  let p = 0;
  return Float32Array.from({length: Math.round(0.12 * SR)}, (_, i) => {
    const t = i / SR;
    p += (2 * Math.PI * (900 - 500 * t / 0.12)) / SR;
    return Math.sin(p) * Math.exp(-t * 40) * 0.25;
  });
};
export const SFX_KINDS = {tick, whoosh, impact, shimmer, pop};

/** events: [{at, kind: tick|whoosh|impact|shimmer|pop, level?=1, pan?: -1..1}] */
export const synthSfx = ({duration, events, out}) => {
  const N = Math.ceil(duration * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  for (const e of events) {
    const gen = SFX_KINDS[e.kind];
    if (!gen) throw new Error(`Unknown sfx kind "${e.kind}". Options: ${Object.keys(SFX_KINDS).join(', ')}`);
    const s = gen();
    const lvl = e.level ?? 1, pan = e.pan ?? 0;
    const start = e.kind === 'whoosh' ? e.at - 0.32 : e.at; // whoosh peaks on the cue
    addAt(L, R, start, s.map((v) => v * lvl), Math.min(1, 1 - pan), Math.min(1, 1 + pan));
  }
  writeWav(out, L, R, -4);
  return out;
};
