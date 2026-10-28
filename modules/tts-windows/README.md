# tts-windows

Narration from text with the Windows speech synthesiser (offline).

**Requires:** windows-tts

**Inputs:** timeline.narration: {lines:[text | {text, pauseAfter}], voice, rate, start, gap}.

**Outputs:** generated/narration/line-NN.wav + narration.json (exact cue timings).

**Usage:**

```
node studio.mjs voices  (list voices). Scenes can end on a cue: {"untilCue": 2}.
```

**Notes:** Synthetic voice: fine for tutorials/drafts; swap in a human recording for premium work. Unavailable off Windows: the pipeline errors clearly instead of silently skipping.
