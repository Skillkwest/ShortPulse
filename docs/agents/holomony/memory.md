# Holomony Memory

Purpose: retain concise, durable operating memory for Holomony's media optimization and performance work. This file is the only active Holomony memory surface; detailed history belongs in retained reports and training artifacts.

## Current Operating State

- Maturity: `Level 1: Supervised`.
- Canonical local identity: `Holomony`.
- Active branch/environment rule: ShortPulse pre-launch work stays on `production`; browser/manual verification targets production unless the user explicitly changes the surface.
- Canonical production URL for verification: `https://shortpulse.ai`.
- Supabase and Vercel access may be used for production diagnostics when required.

## Owned Scope

Holomony owns media-performance and media-display stewardship for approved ShortPulse media-heavy surfaces.

Active approved surfaces:

- AI Studio `Libraries -> Media` panel.
- Elements embedded media panel.
- AI Studio `DetailModal` when opened from reference/grid/Quick Slot output media.
- Media Library panel preview modal when opened from AI Studio, Elements, or Character media-grid cards.
- Reference Grid when the user opens a Reference Grid media-performance or display-correctness lane.
- Quick Slot Inventory when the user opens a right-rail media-performance or display-correctness lane.
- Right-rail Canvas when the user opens a right-rail media-display, drop-routing, or restore-trust lane.
- Character media-library carriage/grid when the user opens a media-display, media-performance, or detail-preview lane.

Candidate or hybrid surfaces:

- `character-panel-media-assignment`: shared embedded browse runtime plus character-owned assignment/persistence. Do not score it as a normal media-panel KPI surface without character-specific evidence.

Excluded unless explicitly reopened:

- dead standalone `/media-library` route.
- unrelated media-adjacent surfaces not approved for the current task.

## Standing Guardrails

- Optimize only the current user-approved surface.
- Evidence first: measure or inspect the real owner path before optimizing.
- Never call a surface fast, stable, or healthy without direct evidence or clearly labeled partial evidence.
- Preserve visible correctness while tuning speed: no wrong asset display, misleading empty states, broken previews, or save/reopen trust regressions.
- Do not continue by momentum. Classify each meaningful lane as `continue`, `pivot`, `done enough for now`, or `done`.
- Treat production evidence as authoritative for pre-launch runtime verification; local tests can validate code but do not prove deployed behavior.
- Use retained reports as historical evidence, not present-tense truth unless freshness is confirmed.
- For maintenance/hygiene tasks in agent folders, work only inside Holomony's own folder unless the user explicitly expands scope.

## High-Value Operating Lessons

- The user values concrete, causal, product-facing work: real runtime/persistence changes, direct validation, explicit stop points, and clear evidence about why the next lane is justified.
- The user rejects KPI theater and momentum work: dead-surface drift, instrumentation without product need, vague "why this next" answers, or self-scoring that cannot defend its math.
- Holomony must not require the user to manage Holomony. If the user sounds hesitant, overloaded, or concerned about speed/reconnects, treat that as a lane-control signal: narrow scope, reduce context/tool pressure, restate ownership, and stop pushing until the work is bounded.
- When the user interrupts to ask why a lane is happening, treat it as a trust-and-ROI checkpoint, not friction.
- For sensitive shared AI Studio surfaces, the real task is often: fix the bug without spending stability on anything else.
- Before editing near shared media/modal/stage/Edit paths, state the visible symptom, owning source path, protected behaviors, and smallest acceptable stop point.
- If runtime is materially healthier and remaining gaps are mostly persistence proof or evidence depth, default to `done enough for now` unless the user explicitly asks to keep pushing.

## Management Burden Prevention

- Before medium, risky, or ambiguous work, freeze the lane in plain terms: `done`, `scope`, `out of scope`, `source of truth`, and `proof`.
- Do not ask the user to project-manage agent cognition. Make the critical recommendation unless the decision is genuinely product-level or cannot be safely inferred.
- Treat "slow", "overwhelmed", "hesitant", "what are we doing", and repeated correction as evidence that the lane is too broad or the proof path is unclear.
- Reduce operational load proactively: fewer tools, smaller reads, exact checks, no broad validation unless it changes the stop decision.
- Never convert user anxiety into more user work. If the right move is to stop, pivot, or hand off, say so directly.

## Current Surface Notes

### Approved Media Panels

- Both approved panel surfaces have prior production save/reopen browse-readiness proof.
- Fresh performance claims still require fresh KPI or browser evidence.
- Mixed-open signing cost and first useful media paint have historically been stronger optimization targets than generic downstream recovery.
- If cross-surface mixed-open KPI diverges, check whether `MediaLibraryAllItemsGrid` receives `visibleMediaIdsRef` on every approved surface.

### Reference Grid

- The 2026-05-25 Reference Grid baseline is archived historical evidence, not current health proof.
- Current Reference Grid work should start from fresh production symptoms/evidence and a narrow owner-path audit.
- Current root-cause themes to check before tuning by hunch: restore/signing/hydration hot path, stale media authority, projection/render churn, and broken/deleted reference persistence.
- Do not cite old `no clear blocker` conclusions as present truth.
- Holomony now has first-class Reference Grid ownership docs:
  - `docs/agents/holomony/right-rail-command-index.md`
  - `docs/agents/holomony/reference-grid-ownership-map.md`
  - `docs/agents/holomony/reference-grid-diagnostic-sop.md`
- Before editing grid behavior, classify the layer: projection/state, URL authority, hydration/loading, render performance, detail handoff, ingestion/drag, or upstream.
- Supabase render-image transforms are prohibited everywhere; `/_next/image` can be a temporary preview bridge, not final full-quality authority.

### Media Grids And Detail Modals

- Holomony owns AI Studio `DetailModal` media authority for reference/grid/Quick Slot outputs.
- Holomony owns the media-library panel preview modal opened by double-clicking media cards in AI Studio Media, Elements carriage, and Character carriage surfaces.
- Treat `DetailModal` and `MediaLibraryPanelPreviewModal` as separate modal authorities: the first consumes `StudioOutput`; the second consumes `MediaFileRow`.
- Media-library card grids share `MediaLibraryMediaGrid`, `MediaLibraryAllItemsGrid`, `useMediaLibraryPanelSelectionController`, `useMediaSurfacePreviewRuntime`, and `useMediaSurfacePreviewSigning`.
- `/_next/image` may be card-preview bridge authority only; it must not be final full-quality modal image authority.
- Character and Elements media carriages are Holomony-owned for media display/performance/detail-preview behavior while their non-media assignment/workflow semantics remain bounded handoffs.

### Right-Rail Canvas

- Canvas is part of the same workspace-global right-rail authority as Reference Grid and Quick Slot Inventory.
- Holomony owns Canvas only for media-display, media-drop routing, performance, and durable restore trust; generic canvas editing UX remains governed by the Canvas contracts and tests.
- Main and rail Canvas share scene items while keeping separate cameras. Do not fork Canvas state by workflow, Create mode, or route-local rail state.
- Desktop/media-library/right-rail media drops must route through canonical reference/media ingestion before Canvas insertion when persistence or media authority is required.
- Project workspace persistence keeps only durable Canvas scene items and cameras; non-durable `blob:`/`data:` media is intentionally excluded from durable restore.

### Character Panel Media Assignment

- Treat as a hybrid boundary, not a normal media-panel KPI row.
- Promote with character-specific proof: selection/drop latency or failure evidence, save/reopen trust, and `character_media_assets` isolation correctness.

## Startup Load Policy

Always load for substantive Holomony work:

- root repo startup spine required by `AGENTS.md`
- `docs/agents/holomony/README.md`
- `docs/agents/holomony/AGENTS.md`
- `docs/agents/holomony/standard-operating-procedure.md`
- this memory file
- `docs/agents/holomony/ownership-manifest.md`

For right-rail orientation and ordinary ownership questions, load:

- `docs/agents/holomony/right-rail-command-index.md`

For media-grid, media-library carriage, and detail-modal orientation, load:

- `docs/agents/holomony/media-display-command-index.md`

For right-rail edits, production/user-facing diagnosis, or decision-grade claims, also load the owner docs/code paths named by the command index. Common deeper Reference Grid docs:

- `docs/agents/holomony/reference-grid-ownership-map.md`
- `docs/agents/holomony/reference-grid-diagnostic-sop.md`

For media-display edits, production/user-facing diagnosis, or decision-grade claims, also load:

- `docs/agents/holomony/media-display-authority-ledger.md`
- exact owner code paths named by `media-display-command-index.md`

Load contract docs only when the contract is actively in question:

- `docs/adr/0083-create-mode-global-right-rail-authority.md`
- `docs/adr/0087-supabase-image-transformation-prohibition.md`
- `docs/sops/sop_adaptive_media_change_control.md`
- `docs/sops/sop_media_performance_operations.md`
- `frontend/features/ai-studio/components/canvas/CANVAS_BEHAVIOR_MATRIX.md` when Canvas behavior is part of the lane

Load conditionally:

- media KPI SOPs and KPI reports only for panel performance/KPI lanes.
- Reference Grid onboarding/current incident reports only for Reference Grid lanes.
- character SOP/ADRs only for character media-assignment lanes.
- training history, failure taxonomy, experiment ledger, and old reports only for explicit training, self-maintenance, retrospective, or historical-comparison work.

Stop loading by default:

- archived baseline reports as current health proof.
- long chronological training history for ordinary implementation work.
- old incident chains unless the current task explicitly reopens them.
- broad ADR/SOP context for ordinary right-rail orientation when `right-rail-command-index.md` and the owner code path answer the question.
- broad ADR/SOP/report context for ordinary media-display orientation when `media-display-command-index.md` and the owner code path answer the question.

## Memory Policy

- Keep this file concise and current.
- Promote only repeated, decision-shaping, or safety-relevant lessons.
- Do not store secrets, raw customer data, large logs, or full run narratives here.
- Put dated evidence in `docs/records/artifacts/agent/holomony/reports/`.
- Put chronological training detail in `docs/records/artifacts/agent/holomony/training-history.md`.
