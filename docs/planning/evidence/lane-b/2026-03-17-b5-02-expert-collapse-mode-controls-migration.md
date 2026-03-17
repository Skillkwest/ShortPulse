# B5-02 Expert Collapse And Mode Controls Migration

- `slice_id`: `B5-02`
- `date_utc`: `2026-03-17`
- `track`: `B-Style`
- `scope`:
  - migrate the neutral collapse/mode control family in `frontend/styles/ai-studio-edit-expert.css`
  - cluster includes:
    - inpaint collapse button defaults
    - collapsed inpaint trigger defaults
    - inpaint mode button defaults
  - keep accent-selected, gradient, and themed hover states intact outside the shared neutral control family
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
  - the collapse/mode control family now consumes shared expert control tokens for pill border/surface/text plus the existing neutral control border/surface/text aliases
  - no selector structure, class names, or import order changed
- `loc_or_coupling_delta`:
  - `frontend/styles/ai-studio-edit-expert.css`: `+10 / -10`
  - `frontend/styles/ai-studio-edit-expert.tokens.css`: `+3 / -0`
  - coupling reduced by removing another small repeated neutral control family from direct literal ownership
- `net_complexity_note`:
  - this was a small but still valid B5-02 slice because it reused the established control contract instead of inventing another token surface
  - it stayed below the threshold where a larger mixed accent migration would have increased risk
- `seam_type`: `shared_extraction`
- `parity_assertions`:
  - no intended visual changes
  - existing accent/themed states remain untouched
- `rollback_note`:
  - revert `frontend/styles/ai-studio-edit-expert.css`, `frontend/styles/ai-studio-edit-expert.tokens.css`, and this packet if parity issues appear in the collapse/mode controls
- `linked_pr`: `local lane-b execution stream`

## Why This Slice Cleared B5-02

1. It reused the existing control token contract instead of opening a new style system branch.
2. It removed direct literals from a coherent neutral control family.
3. It stayed intentionally smaller than the next accent-heavy clusters, which should be migrated separately.
