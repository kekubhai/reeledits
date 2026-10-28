// Renders a Remotion composition (silent video) via the local Remotion CLI.
import path from 'node:path';
import {STUDIO, ensureDir, log, run} from '../_lib/core.mjs';

const CLI = path.join(STUDIO, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
export const ENGINE_ENTRY = path.join(STUDIO, 'library', 'remotion', 'entry.tsx');

/**
 * @param {object} o
 * @param {string} o.entry entry file (registerRoot); defaults to the Studio timeline engine
 * @param {string} o.composition composition id ("Studio" for the engine)
 * @param {string} o.out output mp4
 * @param {string} o.publicDir directory served as staticFile() root
 * @param {string} [o.props] JSON file passed as input props
 * @param {boolean} [o.draft] half-resolution, lower quality
 * @param {number} [o.concurrency=4]
 */
export const renderComposition = ({entry = ENGINE_ENTRY, composition = 'Studio', out, publicDir, props, draft = false, concurrency = 4, frames}) => {
  ensureDir(path.dirname(out));
  const args = [CLI, 'render', entry, composition, out, '--muted', '--codec=h264', `--crf=${draft ? 23 : 14}`, '--pixel-format=yuv420p', `--concurrency=${concurrency}`, '--timeout=120000', '--log=error', `--public-dir=${publicDir}`];
  if (props) args.push(`--props=${props}`);
  if (draft) args.push('--scale=0.5', '--jpeg-quality=75');
  if (frames) args.push(`--frames=${frames}`);
  const t0 = Date.now();
  run(process.execPath, args, {cwd: STUDIO});
  log(`  remotion: ${composition} -> ${path.relative(STUDIO, out)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  return out;
};

export const renderStill = ({entry = ENGINE_ENTRY, composition = 'Studio', out, publicDir, props, frame = 0}) => {
  const args = [CLI, 'still', entry, composition, out, `--frame=${frame}`, '--log=error', `--public-dir=${publicDir}`];
  if (props) args.push(`--props=${props}`);
  run(process.execPath, args, {cwd: STUDIO});
  return out;
};
