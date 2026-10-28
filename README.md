# reeledits

An agent-driven video production studio. Drop in raw footage, describe the video you want, and a coding agent (Claude Code or similar) inspects, plans, edits, renders and validates it — using FFmpeg and Remotion underneath.

Everything is plain files and one CLI, so you can drive it yourself just as well.

## Features

- **Three production methods** — a Remotion timeline engine for motion graphics and UI demos, an FFmpeg cut list for footage-led edits, or fully custom compositions.
- **Templates** for SaaS demos, product launches, explainers, vlogs, talking heads, short- and long-form.
- **Modules** for intake, scene/silence detection, colour, audio cleanup, synthesized music, TTS narration, subtitles and Whisper transcription.
- **Built-in validation** — resolution, duration, loudness, black/frozen frames, subtitle checks, plus a contact sheet for visual review.
- **Isolated projects** — originals in `input/` are never modified; derived files are cached and disposable.

## Requirements

- Node.js 18+
- FFmpeg and FFprobe on `PATH`
- Optional: Windows (built-in TTS narration), a Whisper ggml model in `models/whisper/` (transcription)

## Quick start

```bash
git clone https://github.com/kekubhai/reeledits.git
cd reeledits
npm install
node studio.mjs doctor          # check what's available
```

Create a project:

```bash
node studio.mjs new my-video --template=saas-demo
```

1. Put your footage and images in `projects/videos/my-video/input/`.
2. Describe the video in `projects/videos/my-video/brief.md`.
3. Ask your agent: *"make the video for my-video"* — or run the steps yourself:

```bash
node studio.mjs intake my-video           # inventory + previews of the inputs
node studio.mjs plan my-video             # scaffold plan.md
node studio.mjs render my-video --draft   # fast half-res render
node studio.mjs render my-video           # final master, preview, thumbnail, subtitles, validation
```

Deliverables land in `projects/videos/my-video/output/`.

Run `node studio.mjs help` for every command, and `node studio.mjs templates` / `modules` to see what's available.

## Using with a coding agent

`AGENTS.md` is the operating manual for agents (`CLAUDE.md` points to it). It defines the workflow — understand → plan → produce → render → validate — and the rules: inputs are sacred, no fabricated content, respect asset licences, and always look at the output before calling it done.

## Project layout

```
studio.mjs          CLI entry point
AGENTS.md           agent operating manual
library/remotion/   Remotion engine: scenes, components, themes, overlays
modules/            independent capabilities (intake, prepare, mix, tts, subtitles, validate, …)
templates/          starting points per video type
assets/             studio-wide brand, fonts, music, SFX, overlays
docs/               timeline.json reference
tests/              end-to-end acceptance tests
projects/videos/    one folder per video (git-ignored)
```

Each project contains `project.json`, `brief.md`, `plan.md`, a `timeline.json` or `edit.json`, and the folders `input/`, `assets/`, `generated/`, `renders/` and `output/`.

## Documentation

- [`docs/timeline.md`](docs/timeline.md) — timeline schema for the Remotion engine
- [`modules/ffmpeg-edit/README.md`](modules/ffmpeg-edit/README.md) — `edit.json` schema
- [`assets/README.md`](assets/README.md) — shared assets and licence sidecars
- [`AGENTS.md`](AGENTS.md) — extending Studio with new modules, scenes and templates

## Tests

```bash
npm test                              # three workflows end to end, final quality
node tests/run-acceptance.mjs --draft # faster
```

The tests generate synthetic media with FFmpeg and create the `example-*` projects. See [`tests/ACCEPTANCE_REPORT.md`](tests/ACCEPTANCE_REPORT.md).

## Privacy

`projects/videos/` is git-ignored, so your footage and renders stay local. Caches live in `.cache/` and are safe to delete.

## License

[MIT](LICENSE). Licences for media you add (music, fonts, footage) are your responsibility.
