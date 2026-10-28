// Acceptance tests: three different workflows driven through the real CLI.
//   node tests/run-acceptance.mjs [case ...] [--draft]
// Each case: create project from a template -> add fixture media -> brief + edit
// -> intake -> plan scaffold -> render -> validation. Results: tests/acceptance-results.json.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {PROJECTS, STUDIO, readJson, rel, setupEnv, writeJson} from '../modules/_lib/core.mjs';
import {FIXTURES} from './fixtures.mjs';

setupEnv();
const CASES = {
  'example-saas-demo': {template: 'saas-demo', title: 'DX Dashboard demo (test)', workflow: 'Product demo from a screen recording + logo (Remotion timeline engine)'},
  'example-travel-vlog': {template: 'vlog', title: 'Travel vlog (test)', workflow: 'Vertical vlog from raw clips + photo with natural audio (FFmpeg-only edit)'},
  'example-ai-agents-explainer': {template: 'explainer', title: 'How AI agents work (test)', workflow: 'Educational explainer: TTS narration, animated diagram, subtitles (Remotion)'},
};
const argv = process.argv.slice(2);
const quality = argv.includes('--draft') ? '--draft' : '--final';
const only = argv.filter((a) => !a.startsWith('--'));

const studio = (...a) => {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(STUDIO, 'studio.mjs'), ...a], {cwd: STUDIO, encoding: 'utf8', maxBuffer: 1 << 26});
  return {ok: r.status === 0, out: (r.stdout || '') + (r.stderr || ''), secs: (Date.now() - t0) / 1000};
};
const merge = (a, b) => {
  for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] || {}, v) : v;
  return a;
};

const results = [];
for (const [name, c] of Object.entries(CASES)) {
  if (only.length && !only.includes(name)) continue;
  console.log(`\n######## ${name}: ${c.workflow}`);
  const dir = path.join(PROJECTS, name);
  const steps = {};
  if (!fs.existsSync(path.join(dir, 'project.json'))) steps.new = studio('new', name, `--template=${c.template}`, `--title=${c.title}`);
  // Test-owned files are (re)written every run.
  const caseDir = path.join(STUDIO, 'tests', 'cases', name);
  for (const f of fs.readdirSync(caseDir)) {
    if (f === 'project.patch.json') continue;
    fs.copyFileSync(path.join(caseDir, f), path.join(dir, f));
  }
  if (fs.existsSync(path.join(caseDir, 'project.patch.json'))) {
    const p = readJson(path.join(dir, 'project.json'));
    writeJson(path.join(dir, 'project.json'), merge(p, readJson(path.join(caseDir, 'project.patch.json'))));
  }
  FIXTURES[name](dir);
  steps.intake = studio('intake', name);
  steps.plan = studio('plan', name);
  steps.render = studio('render', name, quality);
  for (const [k, s] of Object.entries(steps)) console.log(`--- ${k} (${s.ok ? 'ok' : 'FAILED'}, ${s.secs.toFixed(1)}s)\n${s.out.trim().split('\n').slice(-40).join('\n')}`);

  const v = readJson(path.join(dir, 'output', quality === '--draft' ? 'validation-draft.json' : 'validation.json'), null);
  const outputs = fs.existsSync(path.join(dir, 'output')) ? fs.readdirSync(path.join(dir, 'output')) : [];
  const manifest = readJson(path.join(dir, 'manifest.json'), {assets: []});
  results.push({
    name,
    workflow: c.workflow,
    template: c.template,
    method: readJson(path.join(dir, 'project.json')).production.method,
    intake: {ok: steps.intake.ok, assets: manifest.assets.map((a) => `${a.kind}:${a.id}`)},
    plan: {ok: steps.plan.ok, file: fs.existsSync(path.join(dir, 'plan.md')) ? rel(STUDIO, path.join(dir, 'plan.md')) : null},
    render: {ok: steps.render.ok, seconds: steps.render.secs},
    validation: v ? {ok: v.ok, checks: v.checks.map((x) => `${x.ok ? 'PASS' : x.level === 'warn' ? 'WARN' : 'FAIL'} ${x.name}: ${x.detail}`), sheet: v.sheet && rel(STUDIO, v.sheet)} : null,
    outputs: outputs.map((o) => rel(STUDIO, path.join(dir, 'output', o))),
  });
}
writeJson(path.join(STUDIO, 'tests', 'acceptance-results.json'), {ranAt: new Date().toISOString(), quality: quality.slice(2), results});
console.log('\n======== summary');
for (const r of results) console.log(`${r.render.ok && r.validation?.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(30)} ${r.method.padEnd(12)} render ${r.render.seconds.toFixed(0)}s  -> ${r.outputs.filter((o) => o.endsWith('.mp4')).join(', ')}`);
if (results.some((r) => !r.render.ok || !r.validation?.ok)) process.exitCode = 1;
