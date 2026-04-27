# B5-02 Expert Secondary Controls Migration

- `slice_id`: `B5-02`
- `date_utc`: `2026-03-17`
- `track`: `B-Style`
- `scope`:
  - migrate the expert secondary-control neutral family in `frontend/styles/ai-studio-edit-expert.css`
  - cluster includes:
    - preset buttons
    - selected layer/input/delete controls
    - secondary title text
    - styles trigger button
  - add the smallest durable doc sync needed in `docs/styles-structure.md`
- `commands_run`:
  - `npm -C frontend run lint`
  - `npm -C frontend run type-check`
  - `npm -C frontend run check:architecture-boundary`
  - `npm -C frontend run check:size-budget`
  - `npm -C frontend run build`
  - `npm -C frontend run docs:check`
- `results`:
  - all commands passed
  - lint remained at the existing baseline `7` warnings
  - the migrated secondary-control family now consumes expert tokens for muted text, selected text, control surface, control border, hover surface, focus surface, and delete affordances
  - `docs/styles-structure.md` now reflects the runtime panel authority and the AI Studio Edit authority order already in use
- `loc_or_coupling_delta`:
  - `frontend/styles/ai-studio-edit-expert.css`: `+26 / -26`
  - `frontend/styles/ai-studio-edit-expert.tokens.css`: `+14 / -2`
  - `docs/styles-structure.md`: `+8 / -0`
  - coupling reduced by moving another coherent neutral family out of repeated literal ownership and into expert tokens
- `net_complexity_note`:
  - this slice keeps the main hotspot flat in net LOC while reducing literal ownership and improving token reuse
  - the doc update is intentionally small and only corrects a durable source-of-truth gap created by the earlier authority work
- `seam_type`: `shared_extraction`
- `parity_assertions`:
  - no class names or selector structure changed
  - no import order changed
  - no intended visual changes; values were preserved during migration
- `rollback_note`:
  - revert `frontend/styles/ai-studio-edit-expert.css`, `frontend/styles/ai-studio-edit-expert.tokens.css`, `docs/styles-structure.md`, and this evidence packet if a parity issue is traced to the migrated controls
- `linked_pr`: `local lane-b execution stream`

## Why This Slice Cleared B5-02

1. It migrated one coherent neutral interaction family instead of scattering replacements across unrelated surfaces.
2. It preserved values while shrinking the direct literal surface in the largest style hotspot.
3. It updated the durable style governance doc only where the runtime authority had already changed.
