# remotion-render

Render a Remotion composition (engine or custom) to silent H.264.

**Requires:** remotion

**Inputs:** entry, composition id, props JSON, public dir.

**Outputs:** renders/video.mp4 (or video-draft.mp4 at half scale).

**Usage:**

```
Called by `render` for method "timeline"; custom projects call the CLI directly.
```

**Notes:** Concurrency 4 and a 120 s frame timeout; temp files on the Studio drive.
