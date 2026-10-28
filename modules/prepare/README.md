# prepare

Trim/CFR/crop/grade footage into JPEG frame sequences for the Remotion engine.

**Requires:** ffmpeg

**Inputs:** timeline.json `media` map: {key: {src, in, out, width, crop, grade, denoise, sharpen, quality}}.

**Outputs:** generated/public/frames/<key>/00001.jpg... (+ .spec.json cache stamp); images copied to generated/public/images/.

**Usage:**

```
Called by `render` for method "timeline".
```

**Notes:** Re-extracts only when the spec or source changes. Frames (not <OffthreadVideo>) because in-render video decoding crashed/hung on Windows under concurrency.
