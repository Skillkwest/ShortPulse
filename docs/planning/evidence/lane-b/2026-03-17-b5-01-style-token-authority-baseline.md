# B5-01 Style Token Authority Baseline

- `slice_id`: `B5-01`
- `date_utc`: `2026-03-17`
- `track`: `B-Style`
- `scope`:
  - freeze the canonical AI Studio Edit panel/token authority before any literal-to-token migration
  - lock the immediate migration surface to:
    - `frontend/styles/ai-studio-edit-theme.css`
    - `frontend/styles/ai-studio-edit-expert.tokens.css`
    - `frontend/styles/ai-studio-edit-expert.css`
    - dependent shared AI Studio style surfaces only when the token contract requires it
  - preserve `frontend/styles/globals.css` import-order invariants
- `commands_run`:
  - `find . -maxdepth 2 -type d \\( -name .next -o -name dist -o -name build -o -name backup -o -name backups -o -name .tmp \\) | sort`
  - `sed -n '1,220p' docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
  - `sed -n '1,220p' docs/archive/planning/lane-b-master-plan-2026-03-16.md`
  - `sed -n '1,220p' docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
  - `sed -n '1,220p' docs/planning/evidence/lane-b/README.md`
  - `sed -n '1,240p' docs/styles-structure.md`
  - `sed -n '1,200p' frontend/styles/globals.css`
  - `sed -n '1,220p' frontend/styles/foundation.css`
  - `sed -n '1,220p' frontend/styles/ai-studio-edit-theme.css`
  - `sed -n '1,220p' frontend/styles/ai-studio-edit-expert.tokens.css`
  - `sed -n '1,260p' frontend/styles/ai-studio-edit-expert.css`
  - `rg -o "#[0-9a-fA-F]{3,8}|rgba?\\([^\\)]*\\)" frontend/styles/ai-studio-edit-expert.css frontend/styles/ai-studio-edit-theme.css frontend/styles/ai-studio-edit-expert.tokens.css | sort | uniq -c | sort -nr | sed -n '1,120p'`
- `results`:
  - canonical runtime panel token is `--color-panel: #1c1f20` in `frontend/styles/foundation.css`
  - Lane B planning docs already record a conflict between runtime/token authority (`#1c1f20`) and older design rationale (`#1C1F26`)
  - `frontend/styles/globals.css` currently imports `ai-studio-edit-theme.css`, then `ai-studio-edit-expert.tokens.css`, then `ai-studio-edit-expert.css`; B5 slices must preserve that sequence
  - `frontend/styles/ai-studio-edit-expert.css` remains the main literal-heavy hotspot at `4593` lines
  - the immediate migration should start with token authority and alias policy, not direct visual rewrites
- `loc_or_coupling_delta`:
  - no production LOC delta in this baseline packet
  - coupling delta is informational: style-token authority is now explicitly locked to runtime CSS instead of split across runtime and rationale docs
- `net_complexity_note`:
  - this baseline reduces execution ambiguity before B5 implementation starts
  - it avoids speculative style edits by locking the canonical source of truth, import order, and first-slice scope
- `seam_type`: `shared_extraction`
- `parity_assertions`:
  - no runtime behavior or style output changed in this baseline slice
  - no class or token values were edited yet
  - B5 implementation must treat `#1c1f20` as the canonical panel tone for phase 1 unless an explicit later decision changes the runtime token
- `rollback_note`:
  - revert this packet and the linked tracker/plan updates if Lane B style work is deferred again
- `linked_pr`: `local lane-b execution stream`

## Style Authority Lock

1. Canonical panel/base tone for B5 phase 1 is `#1c1f20` via `--color-panel` in `frontend/styles/foundation.css`.
2. Any older rationale or inventory text that still cites `#1C1F26` is treated as legacy documentation drift until deliberately migrated.
3. Token work must preserve `globals.css` import order:
   - `ai-studio-edit-theme.css`
   - `ai-studio-edit-expert.tokens.css`
   - `ai-studio-edit-expert.css`

## Immediate Hotspots

1. `frontend/styles/ai-studio-edit-expert.css`
   - `4593` lines
   - highest repeated literals include:
     - `rgba(37, 41, 47, 0.64)` x36
     - `rgba(201, 205, 214, 0.02)` x17
     - `rgba(0, 0, 0, 0.28)` x15
     - `#eef2f8` x14
     - `#101215` x10
2. `frontend/styles/ai-studio-edit-theme.css`
   - already acts as an edit-specific accent authority but still contains repeated amber literals that should converge onto clearer semantic/component tokens
3. `frontend/styles/ai-studio-edit-expert.tokens.css`
   - already provides a scoped token surface but does not yet cover the dominant expert-edit literal clusters

## First-Slice Recommendation

1. Keep `B5-01` focused on authority and contract lock.
2. First implementation slice should:
   - define canonical semantic/component aliases for the most repeated edit-surface literals
   - preserve current rendered values
   - avoid direct style migration in `ai-studio-edit-expert.css` until the alias contract exists
3. `B5-02` should begin only after:
   - token authority is explicit
   - alias policy is documented
   - the scoped no-new-literals guard target list is frozen

## Explicit Non-Goals

1. No visual redesign.
2. No typography-family change.
3. No broad character-manager or workspace-wide style migration in this slice.
4. No changes in Mini Ecosystem scope.
