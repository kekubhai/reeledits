# timeline.json: Remotion engine reference

Used by projects with `production.method: "timeline"`. Times are in **seconds**. Layout adapts to any aspect ratio: sizes are designed at 1080 px on the short edge and scale automatically, and portrait canvases stack layouts vertically.

```jsonc
{
  "width": 1920, "height": 1080, "fps": 30,   // optional: defaults from project.json output
  "theme": { "base": "midnight" | "paper" | "film", "accent": "#RRGGBB", "...": "any Theme field" },
  "fonts": [{ "family": "Brand Sans", "src": "assets/fonts/BrandSans.otf", "weight": "700" }],
  "narration": { ... },          // optional, see below
  "media": { "<key>": { ... } }, // footage/images the scenes use
  "scenes": [ ... ],             // played in order (or at absolute "at")
  "overlays": { ... },
  "audio": { ... }
}
```

## Theme fields

`bg, surface, text, muted, accent, accentText, line, display (font-family), body (font-family), radius, motion: snappy|smooth|calm`.

Bases: `midnight` (dark product look), `paper` (light, readable explainer), `film` (warm editorial).

## media

```jsonc
"screen": { "src": "input/screen-recordings/app.mp4", "in": 3.2, "out": 21.0,
            "width": 1440, "crop": "w:h:x:y", "grade": "none", "denoise": "light", "sharpen": false }
"logo":   { "src": "input/images/logo.png" }      // images are copied as-is
```

Video is trimmed, converted to constant fps and extracted to JPEG frames once (cached until the spec changes). Grades are listed in `modules/color`.

## Scenes

Common fields: `id`, `type`, `duration` **or** `untilCue` (end on a narration cue; `pad`, default 0.6), optional `at` (absolute start), `transition`: `cut | fade | rise | zoom | wipe`, `background`.

| type | Fields |
|---|---|
| `title` | `lines[]`, `accentLine` (index), `kicker`, `sub`, `align: center\|left`, `size` (px@1080), `glow` (bool), `holdToEnd` |
| `footage` | `media`, `from` (s into the segment), `rate`, `fit: cover\|contain`, `zoom: {from:[scale,x%,y%], to:[...]}`, `vignette` |
| `image` | `media`, `fit`, `zoom` (Ken Burns by default) |
| `device` | `media`, `from`, `rate`, `frame: phone\|browser\|none`, `url`, `side: right\|left`, `kicker`, `index`, `title[]`, `body`, `highlights: [{x,y,w,h,label,from,to,round}]` (0..1 of the screen), `zoom: {at, until, scale, x, y}` (punch-in on a UI region) |
| `bullets` | `heading`, `items[]`, `itemAt[]` (reveal times), `kicker`, `dimPast` |
| `diagram` | `title`, `nodes: [{id,label,sub,x,y,at,accent}]` (x,y as 0..1 of the canvas), `edges: [{from,to,label,at,curve}]`, `loop: {edges:[i...], from, period}` (travelling pulse) |
| `endcard` | `title`, `sub`, `cta`, `note`, `fadeToBlack` (default true) |

## narration (optional; Windows TTS)

```jsonc
"narration": { "voice": "Microsoft Zira Desktop", "rate": 0, "start": 0.6, "gap": 0.45,
               "lines": ["One sentence per line.", { "text": "Longer pause after this.", "pauseAfter": 1.2 }] }
```

This produces voice tracks plus exact cue timings. Use `"overlays": {"captions": "narration"}` for captions, and `untilCue` on scenes to fit them to the voice.

## overlays

```jsonc
"captions": "narration" | [{ "from": 1.2, "to": 3.4, "text": "..." }] | { "file": "input/subs.srt", "offset": 0 },
"burnCaptions": true,                       // false = SRT/VTT only
"captionStyle": { "variant": "box" | "plain" | "highlight", "position": "bottom" | "top" | "middle", "size": 38 },
"lowerThirds": [{ "from": 1, "to": 5, "name": "Name", "role": "Role" }],
"watermark": { "text": "BRAND", "position": "top-right" },
"progress": false
```

## audio

```jsonc
"tracks": [{ "src": "input/audio/vo.wav", "at": 0, "in": 0, "out": 30, "role": "voice" | "ambient" | "music" | "sfx",
             "gain": 0, "fadeIn": 0.2, "fadeOut": 0.5, "cleanup": true }],
"music": { "src": "assets/music/track.wav", "gain": -12 }               // licensed file, or
"music": { "synth": { "bpm": 100, "progression": "bright" | "calm" | "driving" | "warm",
                      "sections": [{ "from": 0, "to": 8, "level": 0.8, "bass": true, "groove": true, "arp": true }],
                      "resolveAt": 40 } },
"sfx": [{ "at": 3.0, "kind": "tick" | "whoosh" | "impact" | "shimmer" | "pop", "level": 1, "pan": 0 }],
"duck": true, "loudness": -14, "none": false
```

## Need something the engine can't do?

Write a custom composition. It can import anything from `library/remotion/` (`Studio`, scenes, components). Then set `production.method: "custom"` with steps that call the Remotion CLI. Example:

```json
"production": {
  "method": "custom",
  "custom": {
    "steps": [
      { "run": ["node", "scripts/audio.mjs"] },
      { "run": ["node", "{STUDIO}/node_modules/@remotion/cli/remotion-cli.js", "render",
                "{PROJECT}/composition/index.ts", "MyFilm", "{PROJECT}/renders/_video.mp4",
                "--public-dir={PROJECT}/generated/public", "--codec=h264"] },
      { "run": ["bash", "scripts/mix.sh", "renders/_video.mp4"] }
    ],
    "master": "output/my-film.mp4",
    "duration": 60
  }
}
```

`{STUDIO}`, `{PROJECT}` and `{QUALITY}` are substituted; steps run from the project folder. A step with `skipIfExists` is skipped when that path already exists.
