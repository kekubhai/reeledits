# mix

Voice/ambient/music/sfx mix with music ducking + two-pass loudness mastering.

**Requires:** ffmpeg

**Inputs:** audio plan: {tracks:[{src, at, in, out, gain, role: voice|ambient|music|sfx, fadeIn, fadeOut, cleanup}], loudness (-14), truePeak (-1.5), duck (true)}.

**Outputs:** generated/audio/mix.wav, exact film length, 48 kHz stereo.

**Usage:**

```
Called by `render`; describe audio in timeline.json/edit.json `audio`.
```

**Notes:** Music defaults to -12 dB under voice (-3 dB without voice) and is sidechain-ducked when voice is present.
