# scene-detect

Visual cut / content-change detection.

**Requires:** ffmpeg

**Inputs:** Video file.

**Outputs:** [{time, score}] in generated/analysis/<id>.json.

**Usage:**

```
node studio.mjs analyze <project> <asset-id>
```

**Notes:** Threshold 0.3 by default; lower for subtle changes (screen recordings).
