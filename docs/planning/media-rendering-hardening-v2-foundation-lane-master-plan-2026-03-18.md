# Media Rendering Hardening v2 Foundation Lane Master Plan (2026-03-18)

Last updated: 2026-03-18  
Status: Active  
Owner: Engineering  
Program anchors:
- [Master plan](./media-rendering-hardening-v2-master-plan-2026-03-16.md)
- [Master roadmap](./media-rendering-hardening-v2-master-roadmap-2026-03-16.md)
- [Execution tracker](./media-rendering-hardening-v2-execution-tracker-2026-03-16.md)
- [Risk register](./media-rendering-hardening-v2-risk-register-2026-03-16.md)
- [Decision log](./media-rendering-hardening-v2-decision-log-2026-03-16.md)
- [QA / release checklist](./media-rendering-hardening-v2-qa-release-checklist-2026-03-16.md)
- [Evidence root](./evidence/media-rendering-hardening-v2/README.md)

## Summary
Foundation is the first execution lane for Media Rendering Hardening v2. It is a decision-complete, docs-plus-low-risk-infra lane that must finish before behavior-changing media-delivery work starts.

Foundation owns:
1. Full image/media surface inventory closure.
2. Final per-surface delivery-policy decisions.
3. Telemetry truth and baseline authority.
4. Policy-sensitive test classification and rewrite queue seeding.
5. Durable delivery-policy ADR publication and ADR reconciliation.
6. Pre-implementation stop/go closeout.

Foundation does not own user-visible delivery cutovers, API contract changes, query reshaping, upload retirement, or render-cost implementation.

## Scope Lock
In scope:
1. Surface inventory closure for all hot-path and long-tail surfaces, tracked per surface.
2. Final delivery-policy decisions for route, modal, panel, media-library file modal, media-library panel preview modal, reference-grid, quick-slot, character-grid, quick-swap, detail-modal, and long-tail surfaces.
3. Telemetry field truth classification and baseline evidence rules.
4. Test realignment classification: `Keep`, `Rewrite`, or `Add`.
5. ADR publication for durable delivery-policy choices and reconciliation with existing media ADRs.
6. Stop/go closeout across planning artifacts, evidence naming, and tracker coverage.

Out of scope:
1. User-visible media-delivery behavior changes.
2. Behavior changes to `/api/media/list`, `/api/media/upload`, `/api/media/sign-batch`, or `/api/media/resolve-previews`.
3. Upload-adapter retirement or query-shape implementation.
4. Virtualization, hydration, and render-cost optimizations.
5. `mini-ecosystem/` planning or implementation work.

## Required Companion Docs
Foundation work must stay aligned with:
1. [Contract matrix](./media-rendering-hardening-v2-contract-matrix-2026-03-16.md)
2. [Image surface inventory lock](./media-rendering-hardening-v2-image-surface-inventory-lock-2026-03-16.md)
3. [Surface policy matrix](./media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md)
4. [Telemetry baseline truth spec](./media-rendering-hardening-v2-telemetry-baseline-truth-spec-2026-03-18.md)
5. [Test realignment matrix](./media-rendering-hardening-v2-test-realignment-matrix-2026-03-18.md)
6. [Pre-implementation stop/go checklist](./media-rendering-hardening-v2-pre-implementation-stop-go-checklist-2026-03-18.md)
7. [Foundation P0 inventory and telemetry closure plan](./media-rendering-hardening-v2-foundation-p0-inventory-telemetry-closure-plan-2026-03-18.md)

Operational context remains anchored to [docs/operator-map.md](../operator-map.md), especially rows `media_upload_list_sign_resolve` and `adaptive_media_reference_grid_rendering`.

## Phase Map
### F0: Inventory Lock
Maps to master `P0`.

Outputs:
1. Complete inventory closure for every in-scope image/media surface.
2. Ownership and parity-test references per surface.
3. Evidence-ready inventory packet naming.
4. Per-surface classification closure using the Foundation `P0` inventory/telemetry closure plan.

### F1: Telemetry Truth And Baseline Authority
Maps to master `P0`.

Outputs:
1. Trustworthy-vs-blocked telemetry classification.
2. Baseline packet schema and evidence rules.
3. Explicit exclusion of misleading fields from pass/fail evidence.
4. Emitter-to-metric mapping for the required baseline fields.

### F2: Surface Policy Decision Lock
Maps to master `P1`.

Outputs:
1. One accepted delivery policy per surface and source class.
2. Locked fallback order and proof telemetry per surface.
3. Decision-log alignment for every accepted policy.

### F3: Test Realignment
Maps to master `P4`.

Outputs:
1. Classification of policy-sensitive tests into `Keep`, `Rewrite`, or `Add`.
2. Rewrite/add backlog needed before later cutover slices merge.
3. Explicit isolation of characterization tests that should not block approved policy shifts.

### F4: ADR And Stop/Go Closeout
Maps to master `P0/P1` closeout.

Outputs:
1. Durable delivery-policy ADR publication.
2. ADR reconciliation with [ADR 0018](../adr/0018-adaptive-media-v2-modular-policy-and-surface-adapters.md) and [ADR 0036](../adr/0036-media-library-signed-preview-delivery-and-next-optimizer-bypass.md).
3. Stop/go checklist completion and evidence/index normalization.

## Delivery Policy ADR Rule
Foundation owns the durable delivery-policy ADR for this program.

That ADR must explicitly state:
1. Which parts of ADR 0018 remain authoritative.
2. Whether ADR 0036 is preserved, narrowed, or superseded.
3. How the accepted per-surface policy matrix aligns with shared adaptive-media contracts.

No surface policy may move to `Accepted` without decision-log alignment. Any policy that changes durable architecture must ship with the ADR in the same slice.

## Execution Rules
1. One seam per PR.
2. No product-visible media-delivery changes in this lane.
3. No lane-local tracker. The [master execution tracker](./media-rendering-hardening-v2-execution-tracker-2026-03-16.md) remains the only operational status source.
4. Every completed slice must attach evidence under [docs/planning/evidence/media-rendering-hardening-v2/](./evidence/media-rendering-hardening-v2/README.md).
5. Long-tail surfaces must be represented individually, not bucketed, before the lane closes.

## Exit Criteria
Foundation may close only when:
1. Every in-scope surface has an accepted row in the surface policy matrix or an explicit blocker with owner and unblock criterion.
2. Blocked telemetry fields are excluded from baseline evidence and rollout thresholds.
3. All policy-sensitive tests are classified and queued correctly.
4. The durable delivery-policy ADR is published and reconciled with ADR 0018 and ADR 0036.
5. The stop/go checklist passes with no open no-go condition.
6. The master tracker, decision log, contract matrix, and evidence index agree on Foundation outputs.
