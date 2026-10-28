# ffmpeg-edit

FFmpeg-only editing: cut list -> video with natural audio, crossfades, grade, titles, captions.

**Requires:** ffmpeg

**Inputs:** edit.json: {width,height,fps, clips:[{src,in,out,speed,fit,crop,grade,zoom,audio,volume,transition:{type,duration}}], titles:[{text,from,to,style: center|lower|chapter}], captions, fadeIn, fadeOut, grade, font, audio:{natural, naturalRole, music, sfx}}.

**Outputs:** renders/edit.mov (intermediate), then the shared mix/encode/validate stages.

**Usage:**

```
project.json production.method = "ffmpeg-edit".
```

**Notes:** Text needs a TTF/OTF (assets/fonts or system font). xfade transitions: fade, fadeblack, dissolve, slideleft, wipeleft, smoothleft, circleopen...
