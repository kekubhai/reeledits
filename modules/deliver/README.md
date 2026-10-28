# deliver

Final encode/mux, preview and thumbnail.

**Requires:** ffmpeg

**Inputs:** Rendered video + mix.wav.

**Outputs:** output/<name>.mp4 (H.264 High yuv420p TV range BT.709, AAC 48 kHz, faststart), <name>-preview.mp4, <name>-thumbnail.jpg.

**Usage:**

```
Called by `render`.
```

**Notes:** draft: CRF 26 veryfast; final: CRF 17 slow.
