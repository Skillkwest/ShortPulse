# Media Rendering Hardening v2 Foundation P0 Inventory And Telemetry Closure Plan (2026-03-18)

Last updated: 2026-03-18
Status: Active  
Scope: Foundation lane planning support for `MRH2-P0-001`, `MRH2-P0-002`, and `MRH2-P0-003`

## Purpose
Define the exact planning work required to close Foundation `P0` without adding implementation bloat. This plan exists to turn the existing Foundation lane docs into concrete completion work for:
1. full image/media surface inventory closure,
2. telemetry-truth and baseline-authority closure, and
3. stop/go readiness for later behavior-changing slices.

This is a planning-support document. It is intentionally narrower than the Foundation lane master/execution docs and remains linked into the master program as the working `P0` closure guide.

## Audited Repo Findings
### 1. The current inventory lock is substantially improved but still depends on explicit queued-surface dispositions
The inventory now covers the major hot-path surfaces plus modal/detail and long-tail rows, and the queued annex now captures the remaining repo-discovered surfaces that do not yet need dedicated contract rows. The important closure condition is no longer “find more files blindly”; it is “every remaining file-level surface has an explicit disposition.”

High-value queued entries now fall into three buckets:
1. `ui-chrome-or-static` surfaces such as model logos, toolbar branding, and dashboard static artwork,
2. `queued-to-parent-surface: character-grid` for Character Manager profile-photo behavior, and
3. `queued-to-parent-surface: quick-swap` for Character Manager reference-preview overlay behavior.

`MRH2-P0-001` cannot close until every known queued entry has that explicit disposition and none remain as anonymous file lists.

### 2. The long-tail policy bucketing issue has been corrected, but closure rules still need explicit disposition logic
The [surface policy matrix](./media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md) now represents long-tail surfaces per surface. The remaining closure risk is not bucket drift anymore; it is ensuring all newly discovered render surfaces are either represented directly or explicitly queued with disposition notes.

### 3. The telemetry truth spec is directionally right but timing coverage is narrower than the plan originally implied
The current telemetry truth spec correctly blocks `preview_delivery_mode` and `optimizer_bypassed`, but repo audit shows a second problem: trusted first-card / first-media timing emitters exist for route and modal only.

Trusted or partially trusted timing/sign emitters currently come from:
1. [media-library route timing](../../frontend/pages/media-library.tsx)
2. [media-library route first-media paint](../../frontend/features/media-library/hooks/useMediaPreviewRuntime.ts)
3. [media-library modal timing](../../frontend/features/ai-studio/components/MediaLibraryModal.tsx)
4. [route/modal/panel sign/fallback counts](../../frontend/features/media-library/hooks/useMediaPreviewSigningController.ts)
5. [reference-grid render pressure telemetry](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridTelemetryController.ts)
6. [reference-grid scroll/memory telemetry](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridScrollController.ts)

There are no equivalent trusted first-card / first-media timing emitters today for:
1. `media-library-panel`
2. `media-library-file-modal`
3. `media-library-panel-preview-modal`
4. `reference-grid`
5. `character-grid`
6. `detail-modal`

### 4. The telemetry consumer docs still imply more truth than the code currently supports
[sop_media_performance_operations.md](../sops/sop_media_performance_operations.md) still lists `preview_delivery_mode` and `optimizer_bypassed` as key indicators. That means the planning closure work must explicitly define whether the SOP is:
1. updated later to reflect blocked status, or
2. left unchanged but overridden by the telemetry truth spec for this program.

### 5. Current P0 evidence is not yet sufficient for stop/go closeout
The evidence namespace is correct, but `P0` closure still needs:
1. exact inventory completion criteria,
2. exact baseline packet schema by surface, including approved replacement metrics for surfaces without timing emitters,
3. explicit handling for blocked fields, and
4. confirmation that evidence naming/examples align with the tracker, and
5. explicit rule for queued-but-not-yet-promoted surfaces.

## Goals
1. Close every known inventory gap with explicit per-surface classification.
2. Separate program-critical rendering surfaces from UI chrome/static-image surfaces without excluding either silently.
3. Lock which telemetry fields can and cannot be used for baseline and rollout evidence.
4. Finish the Foundation `P0` planning work without changing live media behavior.

## Non-Goals
1. No renderer or API behavior changes.
2. No sign/resolve/list/upload contract changes.
3. No performance tuning or virtualization work.
4. No Pipeline or Surface lane planning beyond what Foundation `P0` requires.

## Work Packages
### WP1: Inventory Census And Classification
Use repo-wide render callsite discovery as the source list, then normalize each callsite into one of these classes:
1. `program-critical-hot-path`
2. `program-critical-long-tail`
3. `detail/full-quality`
4. `ui-chrome-or-static`

Required outputs:
1. Expand the inventory lock so every in-scope render surface is represented individually.
2. Add notes that distinguish media-delivery contract surfaces from decorative/static uses.
3. Ensure queued annex entries use explicit disposition labels instead of anonymous file lists.

Acceptance:
1. No known `next/image` or raw `<img>` image surface remains unclassified.
2. Every surface has owner, source class, optimizer rule, signing rule, and parity/smoke reference.
3. The inventory lock and policy matrix use the same surface keys for promoted surfaces, and queued entries clearly identify their parent surface or deferred static disposition.

### WP2: Telemetry Emitter And Consumer Audit
Map every required baseline metric to:
1. code emitter,
2. observing surface,
3. trust status,
4. consumer doc or evidence packet that relies on it.

Immediate focus:
1. `first card render timing`
2. `first media paint timing`
3. `sign failure count`
4. `fallback count`
5. `transformed count`
6. blocked fields `preview_delivery_mode` and `optimizer_bypassed`

Required outputs:
1. Emitter map for the hot-path media surfaces.
2. Explicit statement of which fields are blocked for pass/fail use.
3. Baseline packet field list that excludes policy-assumed telemetry and documents approved replacement metrics where timing emitters do not exist.
4. Resolution note for SOP drift versus telemetry truth spec.

Acceptance:
1. Every baseline metric points to a real emitting code path.
2. Blocked fields are clearly excluded from stop/go evidence.
3. Consumer docs that still mention blocked fields are called out for follow-up or same-slice clarification.
4. No surface is treated as timing-instrumented unless a real emitter path is named.

### WP3: Stop/Go Readiness Closure
Turn the inventory and telemetry outputs into a closeable Foundation `P0` package.

Required outputs:
1. `MRH2-P0-001` completion conditions written unambiguously.
2. `MRH2-P0-002` completion conditions written unambiguously.
3. `MRH2-P0-003` stop/go closeout criteria tied to actual artifacts.

Acceptance:
1. The stop/go checklist can be evaluated without interpretation drift.
2. Evidence naming and examples match live tracker IDs.
3. The Foundation execution plan and supporting docs agree on what closes `P0`.

## Deliverables
This plan should drive updates to:
1. [media-rendering-hardening-v2-image-surface-inventory-lock-2026-03-16.md](./media-rendering-hardening-v2-image-surface-inventory-lock-2026-03-16.md)
2. [media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md](./media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md)
3. [media-rendering-hardening-v2-telemetry-baseline-truth-spec-2026-03-18.md](./media-rendering-hardening-v2-telemetry-baseline-truth-spec-2026-03-18.md)
4. [media-rendering-hardening-v2-pre-implementation-stop-go-checklist-2026-03-18.md](./media-rendering-hardening-v2-pre-implementation-stop-go-checklist-2026-03-18.md)
5. [evidence/media-rendering-hardening-v2/README.md](./evidence/media-rendering-hardening-v2/README.md)

## Current Closure Assessment
After the latest repo-audited updates:
1. `MRH2-P0-001` is ready to close because the remaining discovered surfaces are now explicitly dispositioned in the inventory annex.
2. `MRH2-P0-002` is ready to close because the telemetry truth spec now names real emitter coverage and explicitly scopes baseline-safe metrics.
3. `MRH2-P0-003` is ready to close once `P1` policy decisions, ADR reconciliation, and `P4` test classification are accepted.

## Validation Bundle
Planning closure for this document should require:
1. `cd frontend && npm run docs:check`
2. repo-wide render callsite scan using `rg`
3. manual consistency review across inventory lock, policy matrix, telemetry truth spec, stop/go checklist, and Foundation execution plan

## Risks
1. Over-scoping inventory closure into every decorative asset in the repo can create planning noise.
2. Under-scoping inventory closure leaves silent regressions in long-tail or prompt/composer flows.
3. Treating policy-derived telemetry as authoritative will corrupt baseline evidence.

## Operating Rule
If a surface is discovered during `P0` that clearly renders user-visible images but does not fit the current buckets, it must be added and classified. It must not be silently ignored because it is inconvenient to the current plan.

## Self-Audit
This plan is intentionally narrow and high-value:
1. It does not invent a new lane or tracker.
2. It only covers the unfinished Foundation `P0` work already present in the master tracker.
3. It is repo-audited against current render callsites and current telemetry emitters, not written from generic theory.
