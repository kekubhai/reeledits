// Finds pauses in speech. Uses an adaptive threshold (noise floor + margin) because
// outdoor/room noise often sits above fixed thresholds like -40 dB.
import {ffmpeg} from '../_lib/core.mjs';

// 100 ms RMS envelope in dBFS.
export const envelope = (file) => {
  const r = ffmpeg(['-v', 'error', '-i', file, '-vn', '-af', 'highpass=f=120,lowpass=f=4000,aresample=8000,asetnsamples=800,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-', '-f', 'null', '-'], {allowFail: true});
  return r.stdout
    .split('\n')
    .filter((l) => l.includes('RMS_level'))
    .map((l) => Math.max(-90, Number(l.split('=')[1]) || -90));
};

/** @returns {{floor:number, threshold:number, pauses:{from:number,to:number}[], speech:{from:number,to:number}[]}} */
export const detectPauses = (file, {minPause = 0.2, margin = 10} = {}) => {
  const env = envelope(file);
  const sorted = [...env].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)] ?? -60;
  const threshold = floor + margin;
  const pauses = [];
  let start = null;
  env.forEach((v, i) => {
    const t = i * 0.1;
    if (v < threshold && start === null) start = t;
    if (v >= threshold && start !== null) {
      if (t - start >= minPause) pauses.push({from: +start.toFixed(1), to: +t.toFixed(1)});
      start = null;
    }
  });
  if (start !== null) pauses.push({from: +start.toFixed(1), to: +(env.length * 0.1).toFixed(1)});
  const speech = [];
  let cur = 0;
  for (const p of pauses) {
    if (p.from > cur) speech.push({from: +cur.toFixed(1), to: p.from});
    cur = p.to;
  }
  if (cur < env.length * 0.1) speech.push({from: +cur.toFixed(1), to: +(env.length * 0.1).toFixed(1)});
  return {floor, threshold, pauses, speech};
};
