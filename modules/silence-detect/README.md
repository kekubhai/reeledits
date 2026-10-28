# silence-detect

Speech pauses with an adaptive noise-floor threshold.

**Requires:** ffmpeg

**Inputs:** Audio/video file.

**Outputs:** {floor, threshold, pauses[], speech[]} in generated/analysis/<id>.json.

**Usage:**

```
node studio.mjs analyze <project> <asset-id>
```

**Notes:** Fixed thresholds fail on outdoor/room noise; this uses the 10th-percentile level + 10 dB.
