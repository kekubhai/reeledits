# intake

Scan input/ + assets/: probe, hash, previews, compatibility notes -> manifest.json.

**Requires:** ffmpeg, ffprobe

**Inputs:** Folders: project input/ and assets/ (or Studio assets/ with --library). Optional sidecar `<file>.meta.json` with {tags, license, notes}.

**Outputs:** manifest.json (project) or assets/catalog.json (library); previews in generated/intake/.

**Usage:**

```
node studio.mjs intake <project>
node studio.mjs intake --library
```

**Notes:** Idempotent: unchanged files (same size + mtime) reuse cached hash/probe. Never renames, moves or deletes inputs. Duplicates (same SHA-256) and files missing since the last scan are reported, not acted on.
