# D-Bug Handoff: ai-studio-top-tab-panel-mismatch

### Source

- Source agent: Beeper
- Source task: production AI Studio non-generate lane
- Date: 2026-05-15

### Failing surface

- Route, component, script, command, or subsystem: production AI Studio top header layout shortcuts / right-rail panel visibility
- Environment: production
- User-visible symptom: the top AI Studio layout tabs do not map cleanly to the panel state they appear to name
- Exact error text or signature: no thrown runtime error; observed live behavior where `Reference Grid` can show `Right-rail panels are hidden`, and `Quick Slot Inventory` does not clearly produce a quick-slot-specific visible state

### Why this is a D-Bug lane

- Why the source agent stopped: Beeper reproduced the behavior in the live product, corrected an initial cramped-capture mistake with wider evidence, and narrowed the likely code surfaces, but did not patch because the next step is debugging the tab-to-panel state contract.
- Why this should be treated as debugging instead of feature work: the issue is not just copy preference. The visible navigation affordance and the resulting workspace state appear inconsistent.

### Current evidence

- Reproduction steps:
  1. Open a saved production AI Studio project.
  2. Click the top header shortcuts for `Quick Slot Inventory`, `Reference Grid`, and `Canvas`.
  3. Observe the resulting right-rail or canvas panel state.
- Expected behavior:
  - each top shortcut should reveal the surface it names, or
  - clearly indicate why that surface is unavailable
- Actual behavior:
  - `Reference Grid` can land on a `Right-rail panels are hidden` message
  - `Quick Slot Inventory` does not clearly yield a quick-slot-specific visible panel state in the observed run
  - `Canvas` shows a distinct canvas state
- Logs, stack traces, screenshots, or file references:
  - Beeper retained report: `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-ai-studio-non-generate-lane.md`
  - Beeper full workflow report: `docs/agents/beeper/workspace/reports/2026-05-15-production-ai-studio-non-generate-lane.md`
  - Packet notes: `docs/agents/beeper/workspace/runs/2026-05-15-134930-prod-ai-studio-non-generate-lane/notes.md`
  - Evidence JSON:
    - `docs/agents/beeper/workspace/runs/2026-05-15-134930-prod-ai-studio-non-generate-lane/evidence/ai-studio-non-generate-summary.json`
  - Wide screenshots:
    - `studio-xwide-02-quick-slot.png`
    - `studio-xwide-03-reference-grid.png`
    - `studio-xwide-04-canvas.png`
- Frequency: reproduced in production after correcting the viewport width.

### Scope control

- Owned write surface: AI Studio header shortcut / right-rail visibility lane only
- Avoid surface: generate no-op lane, dashboard semantics, broad AI Studio redesign
- In scope:
  - explain the mismatch between selected top shortcut and visible panel state
  - identify whether the issue is state wiring, selected-style drift, or intended hidden-panel logic leaking into the wrong shortcut path
  - propose the smallest safe fix
- Out of scope:
  - new AI Studio features
  - broader design rework
  - branch/push/commit execution

### Attempts already made

1. Reproduced the top-tab behavior in production on a saved project.
2. Captured an initial viewport that was too cramped for safe layout judgment.
3. Re-ran the captures with a much wider viewport and confirmed the mismatch survives the correction.
4. Read the header-shortcut declarations and the right-rail section-label/hidden-state logic.

### Current hypotheses

1. The selected top-tab styling and the underlying `showQuickSlotSection` / `showReferenceGridSection` state are drifting apart.
2. The hidden-panel fallback in `ReferenceGridSections` is reachable from a shortcut path that should instead force the named panel visible.
3. The top shortcuts may be toggling a composite right-rail state whose labels no longer match the current visibility logic.

### Required context

Read first:

- `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-ai-studio-non-generate-lane.md`
- `docs/agents/beeper/workspace/reports/2026-05-15-production-ai-studio-non-generate-lane.md`

Inspect first:

- `frontend/features/ai-studio/components/AiStudioPageContent.tsx` around `168`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx` around `185-197`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx` around `859-861`

### Questions for D-Bug

1. Which state is the true source of truth for those top layout shortcuts?
2. Why can `Reference Grid` lead to the hidden-panel fallback instead of a visible reference-grid panel?
3. Is the problem the selected-tab state, the panel-visibility state, or both?

### Expected output

- debug plan, or
- bounded patch with validation, or
- blocked-with-evidence escalation

### Recommended downstream owner after D-Bug

- Stay with D-Bug, or
- Gear Ball for commit/push/branch-hygiene execution if D-Bug produces the patch

### Suggested validation

- Reproduce on production AI Studio with a wide enough viewport
- Add the smallest local verification around top shortcut -> visible panel mapping
- If patched, confirm that `Quick Slot Inventory`, `Reference Grid`, and `Canvas` each produce the named visible state

### Suggested stop condition

- Stop when D-Bug can explain the tab-to-panel mismatch and name the smallest validated fix path.
- If the behavior is intentional, stop with evidence showing why the labels should still be changed.

### Done state

- D-Bug can explain why AI Studio's top layout shortcuts and visible panel states drift apart in production and can point another engineer to the smallest credible fix path.

### Closeout artifact

- Preferred retained path:
  - `docs/records/artifacts/agent/d-bug/reports/`
- Suggested filename:
  - `2026-05-15-ai-studio-top-tab-panel-mismatch.md`
