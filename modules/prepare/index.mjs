// Prepares footage for the Remotion timeline engine: trims each referenced media
// segment, converts it to constant fps, crops/grades/scales it, and writes a JPEG
// frame sequence into generated/public/frames/<key>/.
//
// Why frames instead of <OffthreadVideo>: in-render video decoding proved unstable
// on Windows (compositor crashes/hangs under concurrency). Images are deterministic.
import fs from 'node:fs';
import path from 'node:path';
import {ensureDir, ffmpeg, hashOf, log, readJson, describeMedia, writeJson} from '../_lib/core.mjs';
import {gradeChain} from '../color/index.mjs';

/**
 * media spec (timeline.media.<key>):
 *   src       project-relative file (video or image)
 *   in, out   seconds in the source (optional; default whole file)
 *   width     output width in px (height follows aspect; default 1920 or source if smaller)
 *   crop      "w:h:x:y" in source pixels (applied before scaling)
 *   grade     colour preset (modules/color), denoise: light|medium, sharpen: bool
 *   quality   JPEG q (2 best .. 31 worst), default 3
 */
export const prepareMedia = (dir, timeline, {draft = false} = {}) => {
  const fps = timeline.fps;
  const pub = ensureDir(path.join(dir, 'generated', 'public'));
  const resolved = {};
  for (const [key, spec] of Object.entries(timeline.media || {})) {
    const src = path.join(dir, spec.src);
    if (!fs.existsSync(src)) throw new Error(`media "${key}": file not found ${spec.src}`);
    const info = describeMedia(src);
    const isImage = info?.video?.still || /\.(png|jpe?g|webp|bmp)$/i.test(src);

    if (isImage) {
      const outDir = ensureDir(path.join(pub, 'images'));
      const out = path.join(outDir, `${key}${path.extname(src).toLowerCase()}`);
      fs.copyFileSync(src, out);
      resolved[key] = {type: 'image', path: `images/${path.basename(out)}`, width: info?.video?.width, height: info?.video?.height};
      continue;
    }

    const width = Math.min(spec.width || 1920, info?.video?.width || 1920) * (draft ? 0.5 : 1);
    const evenW = Math.round(width / 2) * 2;
    const inS = spec.in ?? 0;
    const outS = spec.out ?? info.duration;
    const key8 = hashOf({spec, fps, evenW, mtime: fs.statSync(src).mtimeMs});
    const outDir = path.join(pub, 'frames', key);
    const stamp = path.join(outDir, '.spec.json');
    const cached = fs.existsSync(stamp) && readJson(stamp).key === key8;

    if (!cached) {
      fs.rmSync(outDir, {recursive: true, force: true});
      ensureDir(outDir);
      const vf = [
        `fps=${fps}`,
        spec.crop ? `crop=${spec.crop}` : null,
        `scale=${evenW}:-2:flags=lanczos`,
        gradeChain(spec),
        'format=yuvj420p',
      ]
        .filter(Boolean)
        .join(',');
      ffmpeg(['-v', 'error', '-ss', String(inS), '-to', String(outS), '-i', src, '-an', '-vf', vf, '-q:v', String(spec.quality ?? 3), path.join(outDir, '%05d.jpg')]);
      writeJson(stamp, {key: key8, spec});
      log(`  frames ${key}: ${spec.src} [${inS}-${outS}s] -> ${fs.readdirSync(outDir).length - 1} frames`);
    }
    const count = fs.readdirSync(outDir).filter((f) => f.endsWith('.jpg')).length;
    const first = describeMedia(path.join(outDir, '00001.jpg'));
    resolved[key] = {type: 'frames', dir: `frames/${key}`, count, fps, width: first?.video?.width, height: first?.video?.height, sourceIn: inS};
  }
  return resolved;
};
