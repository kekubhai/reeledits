// Detects visual cuts / big content changes (useful for raw footage and screen recordings).
import {ffmpeg} from '../_lib/core.mjs';

/** @returns {{time:number, score:number}[]} */
export const detectScenes = (file, {threshold = 0.3} = {}) => {
  const r = ffmpeg(['-v', 'info', '-i', file, '-an', '-vf', `scale=320:-2,select='gt(scene,${threshold})',metadata=print:file=-`, '-f', 'null', '-'], {allowFail: true});
  const out = [];
  let t = null;
  for (const line of r.stdout.split('\n')) {
    const m = line.match(/pts_time:([\d.]+)/);
    if (m) t = Number(m[1]);
    const s = line.match(/lavfi\.scene_score=([\d.]+)/);
    if (s && t !== null) out.push({time: +t.toFixed(3), score: +Number(s[1]).toFixed(3)});
  }
  return out;
};
