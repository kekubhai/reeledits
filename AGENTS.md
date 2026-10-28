# Studio: Agent Operating Manual

You are working in **Studio**, a reusable video-production environment. Every video is an independent project in `projects/videos/<name>/`. All commands run from the Studio root through one CLI:

```
node studio.mjs help
```

## The workflow

1. Create or open a project.
2. The user adds raw footage and assets.
3. The user describes the video in `brief.md`.
4. You: **inspect → plan → produce → render → validate**.
5. The user reviews and asks for revisions.

## Stages

### A. Understand
- `node studio.mjs intake <project>` builds `manifest.json`: specs, hashes, compatibility notes, and previews in `generated/intake/`.
- **Look at the previews** (contact sheets/waveforms) with your image viewer. Do not describe footage you have not seen.
- Read `brief.md`. Classify the video type, then read the matching `templates/<type>/NOTES.md` for guidance.
- Speech present? `node studio.mjs analyze <project> <asset-id>` finds pauses and scene cuts. Transcribe if a Whisper model exists, or ask the user for a transcript.
- Ask questions **only** if the answer would materially change the result. Otherwise decide and note it in `plan.md`.

### B. Plan
- `node studio.mjs plan <project>` scaffolds `plan.md`. Fill in the concept, outline, scene table with real source in/out points, voice, subtitles, motion, sound, asset mapping and export.
- Choose the **production method** in `project.json → production.method`:

| Method | Use when | Edit file |
|---|---|---|
| `timeline` | Motion graphics, UI demos, kinetic type, diagrams, explainers, launch films | `timeline.json` (Remotion engine) |
| `ffmpeg-edit` | Footage-led cuts: vlogs, montages, podcast clips, event recaps, quick social edits | `edit.json` |
| `custom` | Anything the above can't express: write a project-specific Remotion composition and/or scripts | `project.json → production.custom.steps` |

Do not force every video through the same look. A vlog is not a SaaS ad, and a tutorial does not need cinematic wipes or music.

### C/D. Prepare + produce
Write `timeline.json` / `edit.json`. Schemas are in `docs/timeline.md` and `modules/ffmpeg-edit/README.md`. Media is referenced by project-relative paths into `input/` or `assets/`. The pipeline extracts, grades and caches what it needs into `generated/`.

### E. Render
```
node studio.mjs render <project> --draft    # half resolution, fast: iterate with this
node studio.mjs render <project>            # final
```

### F. Validate (mandatory)
`render` validates automatically and writes `output/validation.json` plus `renders/review/<name>-sheet.jpg`.
- Fix every FAIL. Judge every WARN; black or frozen frames may be intentional, such as text on black or a static UI.
- **Open the contact sheet and look at it.** Check text, cropping, framing and any missing images. For anything doubtful, extract and view full-resolution frames: `ffmpeg -ss <t> -i output/<name>.mp4 -frames:v 1 renders/review/check.jpg`.
- Never claim a video is visually correct because FFmpeg exited 0. Never claim you *listened*: you can measure audio, not hear it. Tell the user what to listen for.

### G. Deliver
`output/` holds the master (`<name>.mp4`), `-preview.mp4`, `-thumbnail.jpg`, `.srt/.vtt` when there are captions, and `validation.json`. Summarise for the user: the file location, what you verified, what they should check, and known limitations. Record decisions in the project's `AGENTS.md`.

## Rules

- **Inputs are sacred.** Never modify, rename, move or delete files in `input/` or Studio `assets/`. Derived files go in `generated/` or `renders/`.
- **Projects are isolated.** A project only uses its own files, plus Studio `assets/` and `library/` when explicitly referenced.
- **No fabrication.** No invented product features, metrics, testimonials, URLs or quotes. Use only what the footage, materials or user establish.
- **Licensing.** A file's presence is not permission to use it. Check `.meta.json` sidecars and catalog `license` fields, and prefer `music-synth` or user-licensed audio. Never download music or fonts without a clear licence.
- **Restraint.** Every effect must earn its place. Keep UI recordings accurate (no grade, no distortion).
- **Disk.** Keep all temp and cache output inside the Studio folder (`.cache/`); the CLI sets TEMP/TMP.
- **Don't break other projects.** Change `library/`, `modules/` or `templates/` compatibly. Projects using `custom` are frozen snapshots. After changing shared code, run `npm test` (acceptance tests).

## Assets

- Project-level: `projects/videos/<p>/assets/{fonts,music,sound-effects,overlays,logos,graphics}`.
- Studio-wide: `assets/{brand,fonts,music,sound-effects,overlays}`. Run `node studio.mjs intake --library` to build `assets/catalog.json`.
- Metadata: put tags, licence and notes in a sidecar `<file>.meta.json`, e.g. `{"tags":["upbeat"],"license":"CC-BY 4.0, credit X","notes":"use under 30s"}`.
- Select assets for the brief. Never use every asset in every video.

## Extending Studio

- **New module:** create `modules/<name>/` with `index.mjs`, `module.json` (`name`, `description`, `requires`, `optional`) and `README.md` (inputs, outputs, dependencies, usage). `node studio.mjs modules` and `doctor` pick it up automatically. Optional dependencies must fail clearly and never block unrelated workflows.
- **New scene type:** add a component to `library/remotion/scenes.tsx` and register it in `SCENES`. Document it in `docs/timeline.md`.
- **New template:** create `templates/<name>/` with `template.json`, a starter `timeline.json`/`edit.json` and `NOTES.md`.
- **New dependency:** prefer what's installed. Pin exact versions in the root `package.json`, and never upgrade unrelated packages. Run `npm test` afterwards.

## Known environment notes

- Remotion `<OffthreadVideo>` can crash or hang under concurrency on Windows, so footage reaches Remotion as JPEG frame sequences (the `prepare` module).
- FFmpeg `drawtext` crashes on WOFF/WOFF2 and needs TTF/OTF. Remotion can use any web font.
- FFmpeg 8+ has a `whisper` filter; transcription needs a ggml model in `models/whisper/`. Windows TTS (Zira/David) is used for narration.
- If a render fails with memory errors, check for orphaned `remotion.exe`, `ffmpeg.exe` or `chrome-headless-shell.exe` processes from a killed render.
