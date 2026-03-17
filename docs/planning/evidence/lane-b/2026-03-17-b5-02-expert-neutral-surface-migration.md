# B5-02 Expert Neutral Surface Migration

- `slice_id`: `B5-02`
- `date_utc`: `2026-03-17`
- `track`: `B-Style`
- `scope`:
  - migrate one bounded neutral-surface cluster in `frontend/styles/ai-studio-edit-expert.css`
  - cluster includes:
    - stage context menu
    - preset toolbar title/card surfaces
    - neutral compose-image button styling
    - matching disabled neutral states for preset action rows
  - define and use expert-scope neutral tokens in `frontend/styles/ai-studio-edit-expert.tokens.css`
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
  - the targeted neutral literals moved behind expert-scope tokens instead of remaining duplicated in the main expert stylesheet
  - the migrated cluster preserved existing selectors and intended rendered values
- `loc_or_coupling_delta`:
  - `frontend/styles/ai-studio-edit-expert.css`: `+39 / -27`
  - `frontend/styles/ai-studio-edit-expert.tokens.css`: `+23 / -0`
  - coupling reduced by shifting the migrated cluster onto a stable expert token surface
- `net_complexity_note`:
  - this slice intentionally increases token definitions, but only to reduce repeated neutral literals in the main hotspot stylesheet
  - it is a real migration step because the old cluster now consumes expert tokens instead of inline raw values
- `seam_type`: `shared_extraction`
- `parity_assertions`:
  - no class names or selector structure changed
  - no import order changed
  - no known visual-intent changes were introduced; the migration preserves existing colors and emphasis levels
- `rollback_note`:
  - revert `frontend/styles/ai-studio-edit-expert.css`, `frontend/styles/ai-studio-edit-expert.tokens.css`, and this evidence packet if any parity issue is reported in the migrated cluster
- `linked_pr`: `local lane-b execution stream`

## Why This Slice Cleared B5-02

1. It migrates a coherent visual family instead of random literals.
2. It preserves values while reducing direct literal ownership in the largest style hotspot.
3. It leaves the remaining `ai-studio-edit-expert.css` work easier to sequence into future bounded clusters.
