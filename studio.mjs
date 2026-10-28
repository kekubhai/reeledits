#!/usr/bin/env node
// Studio CLI: the single entry point for agents and humans. Run `node studio.mjs help`.
import fs from 'node:fs';
import path from 'node:path';
import {PROJECTS, STUDIO, ensureDir, exists, has, loadProject, log, readJson, rel, run, setupEnv, writeJson} from './modules/_lib/core.mjs';

setupEnv();
const [, , cmd, ...rest] = process.argv;
const flags = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const args = rest.filter((a) => !a.startsWith('--'));

const MODULES_DIR = path.join(STUDIO, 'modules');
const TEMPLATES_DIR = path.join(STUDIO, 'templates');

const listModules = () =>
  fs.readdirSync(MODULES_DIR)
    .filter((d) => exists(path.join(MODULES_DIR, d, 'module.json')))
    .map((d) => ({dir: d, ...readJson(path.join(MODULES_DIR, d, 'module.json'))}));

const checkRequirement = (r) => {
  if (r === 'ffmpeg') return has('ffmpeg');
  if (r === 'ffprobe') return has('ffprobe');
  if (r === 'node') return true;
  if (r === 'remotion') return exists(path.join(STUDIO, 'node_modules', '@remotion', 'cli'));
  if (r === 'windows-tts') return process.platform === 'win32';
  if (r === 'whisper-model') return exists(path.join(STUDIO, 'models', 'whisper')) && fs.readdirSync(path.join(STUDIO, 'models', 'whisper')).some((f) => /^ggml-.*\.bin$/.test(f));
  if (r === 'ffmpeg-whisper') return /\bwhisper\b/.test((ffmpegFilters ??= run('ffmpeg', ['-hide_banner', '-filters'], {allowFail: true}).stdout));
  return false;
};
let ffmpegFilters;

const commands = {
  help() {
    log(`Studio — agent-driven video production

  node studio.mjs <command> [args]

  Projects
    list                              list projects
    new <name> [--template=T] [--title="..."]   create a project from a template
    intake <project>                  scan input/ + assets/ -> manifest.json (+ previews)
    intake --library                  scan Studio assets/ -> assets/catalog.json
    plan <project>                    write plan.md scaffold from brief + manifest (no overwrite)
    render <project> [--draft|--final] [--force]   produce, render, deliver, validate
    validate <project> [file]         technical checks + review contact sheet

  Analysis / helpers
    analyze <project> <asset-id>      pauses (speech) + scene cuts -> generated/analysis/
    transcribe <project> <asset-id>   whisper transcript -> subtitles/<id>.srt (needs model)
    voices                            list local TTS voices

  System
    doctor                            check tools + module availability
    modules                           list modules and what they need
    templates                         list templates
`);
  },

  doctor() {
    const tools = {
      node: process.version,
      ffmpeg: has('ffmpeg') ? 'ok' : 'MISSING (required)',
      ffprobe: has('ffprobe') ? 'ok' : 'MISSING (required)',
      remotion: checkRequirement('remotion') ? 'ok' : 'missing: run npm install',
      'windows-tts': checkRequirement('windows-tts') ? 'ok' : 'unavailable (narration from text disabled)',
      'whisper-model': checkRequirement('whisper-model') ? 'ok' : 'none in models/whisper (transcription disabled)',
    };
    for (const [k, v] of Object.entries(tools)) log(`  ${k.padEnd(14)} ${v}`);
    log('\nModules:');
    commands.modules(true);
  },

  modules(quiet) {
    for (const m of listModules()) {
      const missing = (m.requires || []).filter((r) => !checkRequirement(r));
      log(`  ${m.name.padEnd(20)} ${missing.length ? `UNAVAILABLE (needs ${missing.join(', ')})` : 'ok'.padEnd(10)}  ${quiet === true ? '' : m.description}`);
    }
  },

  templates() {
    for (const d of fs.readdirSync(TEMPLATES_DIR)) {
      const f = path.join(TEMPLATES_DIR, d, 'template.json');
      if (!exists(f)) continue;
      const t = readJson(f);
      log(`  ${d.padEnd(16)} [${t.project.production.method}] ${t.description}`);
    }
  },

  list() {
    if (!exists(PROJECTS)) return log('(no projects)');
    for (const d of fs.readdirSync(PROJECTS)) {
      const f = path.join(PROJECTS, d, 'project.json');
      if (!exists(f)) continue;
      const p = readJson(f);
      const outs = exists(path.join(PROJECTS, d, 'output')) ? fs.readdirSync(path.join(PROJECTS, d, 'output')).filter((x) => x.endsWith('.mp4')) : [];
      log(`  ${d.padEnd(28)} ${(p.type || '').padEnd(16)} ${p.production?.method || ''}  ${outs.length ? 'rendered: ' + outs.join(', ') : ''}`);
    }
  },

  new() {
    const name = args[0];
    if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error('Usage: new <name> (lowercase, digits, dashes)');
    const tplName = flags.template || 'blank';
    const tplDir = path.join(TEMPLATES_DIR, tplName);
    if (!exists(path.join(tplDir, 'template.json'))) throw new Error(`Unknown template "${tplName}". See: node studio.mjs templates`);
    const dir = path.join(PROJECTS, name);
    if (exists(dir)) throw new Error(`Project already exists: ${rel(STUDIO, dir)}`);
    const tpl = readJson(path.join(tplDir, 'template.json'));
    ensureDir(dir);
    for (const sub of tpl.inputDirs || ['footage', 'audio', 'images']) ensureDir(path.join(dir, 'input', sub));
    ensureDir(path.join(dir, 'output'));
    writeJson(path.join(dir, 'project.json'), {name, title: flags.title || name, type: tpl.type, template: tplName, created: new Date().toISOString().slice(0, 10), ...tpl.project});
    for (const f of tpl.files || []) fs.copyFileSync(path.join(tplDir, f), path.join(dir, f));
    const agents = fs.readFileSync(path.join(TEMPLATES_DIR, '_project', 'AGENTS.md'), 'utf8').replaceAll('{{NAME}}', name).replaceAll('{{TEMPLATE}}', tplName);
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), agents);
    if (!exists(path.join(dir, 'brief.md'))) fs.copyFileSync(path.join(TEMPLATES_DIR, '_project', 'brief.md'), path.join(dir, 'brief.md'));
    log(`Created ${rel(STUDIO, dir)} from template "${tplName}".
Next: add files to ${rel(STUDIO, path.join(dir, 'input'))}/, describe the video in brief.md, then:
  node studio.mjs intake ${name}`);
  },

  async intake() {
    const m = await import('./modules/intake/index.mjs');
    if (flags.library) return m.intakeLibrary();
    m.intakeProject(loadProject(args[0]).dir);
  },

  plan() {
    const {dir, project, name} = loadProject(args[0]);
    const out = path.join(dir, 'plan.md');
    if (exists(out) && !flags.force) return log(`plan.md exists (use --force to regenerate the scaffold). ${rel(STUDIO, out)}`);
    const man = readJson(path.join(dir, 'manifest.json'), {assets: []});
    const rows = man.assets.map((a) => `| ${a.id} | ${a.kind} | ${a.media?.video ? `${a.media.video.width}x${a.media.video.height} ${a.media.video.fps}fps ` : ''}${a.media?.duration ? a.media.duration + 's' : ''} | ${a.compatibility.join('; ')} |`).join('\n');
    const tpl = fs.readFileSync(path.join(TEMPLATES_DIR, '_project', 'plan.md'), 'utf8');
    fs.writeFileSync(out, tpl.replace('{{TITLE}}', project.title || name).replace('{{METHOD}}', project.production?.method || 'timeline').replace('{{OUTPUT}}', `${project.output?.width}x${project.output?.height} @ ${project.output?.fps} fps`).replace('{{ASSETS}}', rows || '| (run intake first) | | | |'));
    log(`Wrote ${rel(STUDIO, out)}; fill it in, then implement timeline.json / edit.json.`);
  },

  async render() {
    const {renderProject} = await import('./modules/pipeline/index.mjs');
    const ctx = loadProject(args[0]);
    const r = renderProject(ctx, {quality: flags.draft ? 'draft' : 'final', force: !!flags.force});
    if (!r.ok) process.exitCode = 1;
  },

  async validate() {
    const {validateProject} = await import('./modules/pipeline/index.mjs');
    const r = validateProject(loadProject(args[0]), args[1]);
    if (!r.ok) process.exitCode = 1;
  },

  async analyze() {
    const {dir} = loadProject(args[0]);
    const man = readJson(path.join(dir, 'manifest.json'));
    const a = man.assets.find((x) => x.id === args[1]);
    if (!a) throw new Error(`asset "${args[1]}" not in manifest (run intake)`);
    const file = path.join(dir, a.path);
    const out = {asset: a.id};
    if (a.media?.audio?.length) out.pauses = (await import('./modules/silence-detect/index.mjs')).detectPauses(file);
    if (a.media?.video && !a.media.video.still) out.scenes = (await import('./modules/scene-detect/index.mjs')).detectScenes(file);
    const f = path.join(dir, 'generated', 'analysis', `${a.id}.json`);
    writeJson(f, out);
    log(`pauses: ${out.pauses?.pauses.length ?? '-'}  scene cuts: ${out.scenes?.length ?? '-'}  -> ${rel(STUDIO, f)}`);
  },

  async transcribe() {
    const {dir} = loadProject(args[0]);
    const man = readJson(path.join(dir, 'manifest.json'));
    const a = man.assets.find((x) => x.id === args[1]);
    if (!a) throw new Error(`asset "${args[1]}" not in manifest (run intake)`);
    const {transcribe} = await import('./modules/transcribe-whisper/index.mjs');
    const cues = transcribe(path.join(dir, a.path), path.join(ensureDir(path.join(dir, 'subtitles')), a.id), {language: flags.language || 'auto'});
    log(`${cues.length} cues -> subtitles/${a.id}.srt`);
  },

  async voices() {
    const {listVoices} = await import('./modules/tts-windows/index.mjs');
    listVoices().forEach((v) => log('  ' + v));
  },
};

const fn = commands[cmd || 'help'];
if (!fn) {
  log(`Unknown command "${cmd}".`);
  commands.help();
  process.exit(1);
}
try {
  await fn();
} catch (e) {
  console.error(`\nError: ${e.message}`);
  process.exit(1);
}
