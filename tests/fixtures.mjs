// Generates small synthetic "raw" media for acceptance tests (no downloads).
// These stand in for user footage; they are clearly test material, not real products.
import fs from 'node:fs';
import path from 'node:path';
import {ensureDir, ffmpeg, findTtf, posix} from '../modules/_lib/core.mjs';

const make = (file, args, cwd) => {
  if (fs.existsSync(file)) return;
  ensureDir(path.dirname(file));
  ffmpeg(['-v', 'error', ...args, file], {cwd});
};

// Text burned with drawtext needs a TTF; run in the font's folder to avoid path escaping.
const withFont = (fn) => {
  const font = findTtf();
  if (!font) throw new Error('No TTF font available for fixture text');
  return fn(font);
};

export const FIXTURES = {
  // Screen-recording stand-in: 16:10 "app" with moving elements + logo image.
  'example-saas-demo': (dir) => {
    make(path.join(dir, 'input/screen-recordings/app-session.mp4'), [
      '-f', 'lavfi', '-i', 'testsrc2=s=1440x900:r=30:d=12',
      '-vf', 'drawbox=x=0:y=0:w=1440:h=70:color=0x1E2233@1:t=fill,drawbox=x=0:y=70:w=220:h=830:color=0x161A26@1:t=fill,drawbox=x=1180:y=14:w=220:h=42:color=0x4F7CFF@1:t=fill',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    ]);
    withFont((font) => {
      const tmp = path.join(dir, 'input/images');
      ensureDir(tmp);
      fs.copyFileSync(font, path.join(tmp, '.fixture-font.ttf'));
      make(path.join(tmp, 'logo.png'), ['-f', 'lavfi', '-i', 'color=c=0x4F7CFF:s=600x600:d=1', '-vf', "drawtext=fontfile=.fixture-font.ttf:text='DX':fontsize=280:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2", '-frames:v', '1', '-update', '1'], tmp);
      fs.rmSync(path.join(tmp, '.fixture-font.ttf'));
    });
  },

  // "Camera" clips with natural-sound stand-ins (ambience), one still photo.
  'example-travel-vlog': (dir) => {
    const f = (n) => path.join(dir, 'input/footage', n);
    make(f('clip-01-sunrise.mp4'), ['-f', 'lavfi', '-i', 'gradients=s=1920x1080:r=30:d=6:speed=0.015:c0=0xF2A65A:c1=0x5A2E91:c2=0x1B1035:nb_colors=3', '-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.08:d=6', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac']);
    make(f('clip-02-streets.mp4'), ['-f', 'lavfi', '-i', 'mandelbrot=s=1920x1080:r=30:end_scale=0.4:inner=convergence', '-f', 'lavfi', '-i', 'anoisesrc=color=brown:amplitude=0.12:d=6', '-t', '6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-c:a', 'aac']);
    make(f('clip-03-market.mov'), ['-f', 'lavfi', '-i', 'life=s=640x360:r=30:mold=10:ratio=0.12:death_color=#2B1B12:life_color=#F2C14E,scale=1920:1080:flags=neighbor', '-f', 'lavfi', '-i', 'sine=f=330:d=6,volume=0.05', '-t', '6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-c:a', 'aac']);
    make(path.join(dir, 'input/images/photo-rooftop.jpg'), ['-f', 'lavfi', '-i', 'gradients=s=2400x1600:d=1:c0=0x203A43:c1=0x2C5364:c2=0xF2A65A:nb_colors=3', '-frames:v', '1', '-update', '1', '-q:v', '2']);
  },

  // Explainer: narration is generated from text by the pipeline (Windows TTS); nothing to add.
  'example-ai-agents-explainer': () => {},
};

export const relPosix = posix;
