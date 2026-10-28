// Pure-FFmpeg editing path (no Remotion): an edit decision list becomes a video with
// natural audio, cuts/crossfades, colour, titles and burned-in captions.
// Suits vlogs, montages, podcast clips and quick social cuts.
import fs from 'node:fs';
import path from 'node:path';
import {describeMedia, ensureDir, ffmpeg, findTtf, log} from '../_lib/core.mjs';
import {gradeChain} from '../color/index.mjs';
import {wrap} from '../subtitles/index.mjs';

const atempo = (speed) => {
  // atempo accepts 0.5..2 per instance; chain for wider ranges.
  const parts = [];
  let s = speed;
  while (s > 2) parts.push('atempo=2'), (s /= 2);
  while (s < 0.5) parts.push('atempo=0.5'), (s /= 0.5);
  parts.push(`atempo=${s.toFixed(4)}`);
  return parts.join(',');
};

/**
 * @param {string} dir project dir
 * @param {object} edl see modules/ffmpeg-edit/README.md
 * @param {string} out output mp4 (intermediate, with natural audio)
 * @returns {{duration:number}}
 */
export const renderEdit = (dir, edl, out, {draft = false} = {}) => {
  const W = Math.round((edl.width * (draft ? 0.5 : 1)) / 2) * 2;
  const H = Math.round((edl.height * (draft ? 0.5 : 1)) / 2) * 2;
  const fps = edl.fps || 30;
  const work = ensureDir(path.join(dir, 'generated', 'edit'));
  const args = [];
  const chains = [];
  const clips = edl.clips;
  let input = 0;
  const durs = [];

  clips.forEach((c, i) => {
    const src = path.join(dir, c.src);
    if (!fs.existsSync(src)) throw new Error(`clip ${i + 1}: not found ${c.src}`);
    const info = describeMedia(src);
    const speed = c.speed || 1;
    const inS = c.in ?? 0;
    const outS = c.out ?? info.duration;
    const d = (outS - inS) / speed;
    durs.push(d);
    const isImage = info.video?.still;
    if (isImage) args.push('-loop', '1', '-t', String(d), '-i', src);
    else args.push('-ss', String(inS), '-to', String(outS), '-i', src);
    const vi = input++;
    const fit = c.fit || 'cover';
    const scale = fit === 'cover'
      ? `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}`
      : `scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`;
    const zoom = c.zoom ? `,zoompan=z='min(${c.zoom}, 1+(${c.zoom}-1)*on/${Math.round(d * fps)})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${fps}` : '';
    const grade = gradeChain({grade: c.grade ?? edl.grade ?? 'none', denoise: c.denoise ?? edl.denoise});
    chains.push(`[${vi}:v]${c.crop ? `crop=${c.crop},` : ''}setpts=(PTS-STARTPTS)/${speed},fps=${fps},${scale}${zoom},setsar=1${grade ? ',' + grade : ''},format=yuv420p,trim=duration=${d.toFixed(3)},settb=1/${fps}[v${i}]`);

    const keepAudio = c.audio !== false && info.audio.length && !isImage;
    if (keepAudio) {
      chains.push(`[${vi}:a]asetpts=PTS-STARTPTS,${speed !== 1 ? atempo(speed) + ',' : ''}aformat=sample_rates=48000:channel_layouts=stereo,volume=${c.volume ?? 0}dB,atrim=duration=${d.toFixed(3)},apad=whole_dur=${d.toFixed(3)}[a${i}]`);
    } else {
      args.push('-f', 'lavfi', '-t', String(d), '-i', 'anullsrc=r=48000:cl=stereo');
      chains.push(`[${input++}:a]anull[a${i}]`);
    }
  });

  // Join: crossfade where a transition is set, otherwise a hard cut.
  let v = '[v0]', a = '[a0]', total = durs[0];
  for (let i = 1; i < clips.length; i++) {
    const t = clips[i - 1].transition;
    if (t && t.duration > 0) {
      const off = (total - t.duration).toFixed(3);
      chains.push(`${v}[v${i}]xfade=transition=${t.type || 'fade'}:duration=${t.duration}:offset=${off},settb=1/${fps}[vx${i}]`);
      chains.push(`${a}[a${i}]acrossfade=d=${t.duration}[ax${i}]`);
      total += durs[i] - t.duration;
    } else {
      chains.push(`${v}${a}[v${i}][a${i}]concat=n=2:v=1:a=1[vc${i}][ax${i}]`);
      chains.push(`[vc${i}]settb=1/${fps}[vx${i}]`);
      total += durs[i];
    }
    v = `[vx${i}]`;
    a = `[ax${i}]`;
  }

  // Titles and burned captions via drawtext (TTF required; text passed via files to avoid escaping).
  const overlays = [...(edl.titles || []).map((t) => ({...t})), ...(edl.captions || []).map((c) => ({...c, style: 'caption'}))];
  const post = [];
  if (overlays.length) {
    const font = edl.font ? path.join(dir, edl.font) : findTtf(path.join(dir, 'assets', 'fonts'));
    if (!font) throw new Error('No TTF/OTF font found for titles (add one to assets/fonts).');
    fs.copyFileSync(font, path.join(work, 'font' + path.extname(font)));
    const fontRel = 'font' + path.extname(font);
    overlays.forEach((o, k) => {
      const style = o.style || 'center';
      const size = Math.round(H * ({center: 0.085, lower: 0.045, chapter: 0.032, caption: 0.042}[style] || 0.06) * (o.scale || 1));
      const lines = style === 'caption' ? wrap(o.text, W > H ? 48 : 28) : [o.text];
      fs.writeFileSync(path.join(work, `t${k}.txt`), lines.join('\n'));
      const fadeD = Math.min(0.35, (o.to - o.from) / 4);
      const alpha = `if(lt(t,${o.from + fadeD}),(t-${o.from})/${fadeD},if(gt(t,${o.to - fadeD}),(${o.to}-t)/${fadeD},1))`;
      const pos = {
        center: `x=(w-text_w)/2:y=(h-text_h)/2`,
        lower: `x=${Math.round(W * 0.06)}:y=h-text_h-${Math.round(H * 0.12)}:box=1:boxcolor=black@0.45:boxborderw=${Math.round(size * 0.45)}`,
        chapter: `x=${Math.round(W * 0.06)}:y=${Math.round(H * 0.07)}`,
        caption: `x=(w-text_w)/2:y=h-text_h-${Math.round(H * (W > H ? 0.08 : 0.2))}:box=1:boxcolor=black@0.6:boxborderw=${Math.round(size * 0.4)}:line_spacing=${Math.round(size * 0.25)}:text_align=C`,
      }[style];
      post.push(`drawtext=fontfile=${fontRel}:textfile=t${k}.txt:fontsize=${size}:fontcolor=${o.color || 'white'}:shadowcolor=black@0.5:shadowx=2:shadowy=2:${pos}:alpha='${alpha}':enable='between(t,${o.from},${o.to})'`);
    });
  }
  if (edl.fadeIn) post.push(`fade=t=in:st=0:d=${edl.fadeIn}`);
  if (edl.fadeOut) post.push(`fade=t=out:st=${(total - edl.fadeOut).toFixed(3)}:d=${edl.fadeOut}`);
  chains.push(`${v}${post.length ? post.join(',') : 'null'}[vout]`);
  const afx = [];
  if (edl.fadeIn) afx.push(`afade=t=in:d=${edl.fadeIn}`);
  if (edl.fadeOut) afx.push(`afade=t=out:st=${(total - edl.fadeOut).toFixed(3)}:d=${edl.fadeOut}`);
  chains.push(`${a}${afx.length ? afx.join(',') : 'anull'}[aout]`);

  const graphFile = path.join(work, 'graph.txt');
  fs.writeFileSync(graphFile, chains.join(';\n'));
  // Intermediate is MOV so the natural audio stays lossless PCM between stages.
  const mov = path.resolve(out).replace(/\.[a-z0-9]+$/i, '.mov');
  ensureDir(path.dirname(mov));
  ffmpeg(['-v', 'error', ...args, '-/filter_complex', 'graph.txt', '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-crf', draft ? '24' : '15', '-preset', draft ? 'veryfast' : 'medium', '-threads', '4', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-t', total.toFixed(3), mov], {cwd: work});
  log(`  edit: ${clips.length} clips, ${overlays.length} text overlays -> ${total.toFixed(2)}s`);
  return {duration: +total.toFixed(3), file: mov};
};
