# transcribe-whisper

Speech-to-text via FFmpeg whisper filter (optional).

**Requires:** ffmpeg-whisper, whisper-model

**Inputs:** Any audio/video asset; a ggml model in models/whisper/.

**Outputs:** subtitles/<asset-id>.srt.

**Usage:**

```
node studio.mjs transcribe <project> <asset-id> [--language=en]
```

**Notes:** Models are NOT downloaded automatically. Enable: download e.g. ggml-base.en.bin from huggingface.co/ggerganov/whisper.cpp into models/whisper/, then `node studio.mjs doctor`.
