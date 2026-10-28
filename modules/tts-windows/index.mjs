// Narration via the Windows built-in speech synthesiser (System.Speech / SAPI).
// Local, offline, no downloads. Synthetic voice quality: good for drafts, tutorials
// and placeholders; replace with a human recording for premium work.
import fs from 'node:fs';
import path from 'node:path';
import {describeMedia, ensureDir, ffmpeg, run, writeJson} from '../_lib/core.mjs';

export const available = () => process.platform === 'win32' && run('powershell', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.Speech; "ok"'], {allowFail: true}).ok;

export const listVoices = () => {
  const r = run('powershell', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | % { $_.VoiceInfo.Name }'], {allowFail: true});
  return r.ok ? r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
};

/**
 * Speaks each line to its own WAV and lays them out with gaps, returning exact timings.
 * @param {object} o
 * @param {string[]} o.lines narration, one caption-sized sentence per entry
 * @param {string} o.outDir directory for WAVs + narration.json
 * @param {string} [o.voice] e.g. "Microsoft Zira Desktop"
 * @param {number} [o.rate=0] -10..10
 * @param {number} [o.start=0.6] seconds before the first line
 * @param {number} [o.gap=0.45] seconds between lines (or per-line `{text, pauseAfter}`)
 */
export const narrate = ({lines, outDir, voice, rate = 0, start = 0.6, gap = 0.45}) => {
  ensureDir(outDir);
  const items = lines.map((l) => (typeof l === 'string' ? {text: l} : l));
  const script = items
    .map((it, i) => {
      const wav = path.join(outDir, `line-${String(i + 1).padStart(2, '0')}.raw.wav`).replace(/'/g, "''");
      const text = it.text.replace(/'/g, "''");
      return `$s.SetOutputToWaveFile('${wav}'); $s.Speak('${text}');`;
    })
    .join(' ');
  const voiceCmd = voice ? `$s.SelectVoice('${voice.replace(/'/g, "''")}');` : '';
  run('powershell', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ${voiceCmd} $s.Rate = ${rate}; ${script} $s.Dispose()`]);

  let t = start;
  const cues = [];
  items.forEach((it, i) => {
    const raw = path.join(outDir, `line-${String(i + 1).padStart(2, '0')}.raw.wav`);
    const wav = raw.replace('.raw.wav', '.wav');
    // trim SAPI's leading/trailing silence, convert to 48 kHz
    ffmpeg(['-v', 'error', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,aresample=48000', '-c:a', 'pcm_s16le', wav]);
    fs.rmSync(raw);
    const d = describeMedia(wav).duration;
    cues.push({from: +t.toFixed(3), to: +(t + d).toFixed(3), text: it.text, file: path.basename(wav), duration: d});
    t += d + (it.pauseAfter ?? gap);
  });
  const result = {voice: voice || 'default', rate, totalDuration: +t.toFixed(3), cues};
  writeJson(path.join(outDir, 'narration.json'), result);
  return result;
};
