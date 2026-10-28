# validate

Technical validation + review contact sheet.

**Requires:** ffmpeg, ffprobe

**Inputs:** A rendered video, expectations (size, fps, duration, loudness), subtitle files.

**Outputs:** output/validation.json; renders/review/<name>-sheet.jpg.

**Usage:**

```
node studio.mjs validate <project> [file]
```

**Notes:** Checks: streams, resolution, fps, duration, pixel format, silence, clipping, loudness, tail decay, black/frozen segments, subtitle sanity. Passing is necessary, not sufficient: look at the sheet.
