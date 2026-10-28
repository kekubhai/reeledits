# audio-cleanup

Speech cleanup chain (rumble, denoise, EQ, compression).

**Requires:** ffmpeg

**Inputs:** Any audio/video file with speech.

**Outputs:** Cleaned WAV (cleanFile) or the VOICE_CHAIN filter used by mix for role "voice".

**Usage:**

```
Automatic for voice tracks; disable per track with "cleanup": false.
```

**Notes:** Conservative settings: preserves natural speech.
