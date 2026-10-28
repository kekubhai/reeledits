# color

Restrained colour presets (FFmpeg filter chains).

**Requires:** ffmpeg

**Inputs:** grade: none | lift-face | warm | clean | cool | muted; denoise: light | medium; sharpen: bool.

**Outputs:** A filter string used by prepare and ffmpeg-edit.

**Usage:**

```
In timeline media specs or edit.json clips: "grade": "warm".
```

**Notes:** Correct first, then style. Keep screen recordings on "none" so UI colours stay accurate. Add presets in modules/color/index.mjs.
