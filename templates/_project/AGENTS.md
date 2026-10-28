# Project: {{NAME}}

Agent instructions for this project. Studio-wide rules are in `../../../AGENTS.md`: read those first.

Started from template: `{{TEMPLATE}}` (a starting point, not a constraint).

## Files here

| Path | What | Who writes it |
|---|---|---|
| `brief.md` | What the user wants | User (agent may append clarifications) |
| `project.json` | Output format, production method, deliverables | Agent |
| `manifest.json` | Asset inventory | `node studio.mjs intake {{NAME}}` |
| `plan.md` | Creative concept, scene breakdown, asset mapping | Agent (Stage B) |
| `timeline.json` / `edit.json` | The edit itself | Agent |
| `input/` | Original user files | User only. **Never modify, rename or delete.** |
| `assets/` | Project-specific fonts, logos, music, overlays | User or agent |
| `generated/` | Derived/intermediate files (safe to delete) | Pipeline |
| `renders/` | Intermediate renders, review sheets | Pipeline |
| `output/` | Deliverables | Pipeline |

## Project notes

<!-- Record decisions, user feedback and revision history here. -->
