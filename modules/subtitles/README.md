# subtitles

SRT/VTT writing, parsing, line wrapping and validation.

**Requires:** node

**Inputs:** Cues [{from,to,text}] (seconds); or an .srt/.vtt file.

**Outputs:** output/<name>.srt and .vtt (two lines max, 42 chars default).

**Usage:**

```
overlays.captions: "narration" | [cues] | {file, offset}. project.output.subtitles: ["srt","vtt"] or [].
```

**Notes:** Overlaps are trimmed; long cues are split by character share.
