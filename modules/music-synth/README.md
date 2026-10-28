# music-synth

Original music bed + SFX synthesis (no samples, no licensing risk).

**Requires:** node

**Inputs:** audio.music.synth: {bpm, progression: bright|calm|driving|warm, sections:[{from,to,level,bass,groove,arp}], resolveAt, fadeOut}; audio.sfx: [{at, kind: tick|whoosh|impact|shimmer|pop, level, pan}].

**Outputs:** generated/audio/music.wav, generated/audio/sfx.wav.

**Usage:**

```
Set audio.music.synth / audio.sfx in the timeline. Use audio.music.src for a licensed track instead.
```

**Notes:** Deterministic output. For premium work a licensed or commissioned track usually beats synthesis; record its licence in a .meta.json sidecar.
