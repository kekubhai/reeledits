# Studio asset library

Shared assets any project may use **when the brief calls for them**.

| Folder | For |
|---|---|
| `brand/` | Logos, brand guides, colour files |
| `fonts/` | TTF/OTF (work everywhere) or WOFF/WOFF2 (Remotion only) |
| `music/` | Licensed music beds |
| `sound-effects/` | Licensed SFX |
| `overlays/` | Film grain, light leaks, textures |

Add a sidecar `<file>.meta.json` describing usage rights, for example:

```json
{ "tags": ["calm", "piano"], "license": "Purchased from X, commercial OK, no attribution", "notes": "loops at 32 s" }
```

Then run `node studio.mjs intake --library` to refresh `catalog.json`.

A file being here does **not** mean it may be used commercially. Check the licence first.
