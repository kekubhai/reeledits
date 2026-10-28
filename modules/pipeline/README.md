# pipeline

Stage orchestration for timeline / ffmpeg-edit / custom methods.

**Requires:** ffmpeg, node

**Inputs:** project.json + timeline.json or edit.json.

**Outputs:** Everything above, in the project folders.

**Usage:**

```
node studio.mjs render <project> [--draft|--final]
```

**Notes:** Add a new production method by adding a branch in renderProject().
