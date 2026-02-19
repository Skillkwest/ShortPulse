# AI Studio Generation Runtime Stabilization

Status: Planned  
Owner: AI Studio Engineering  
Last updated: 2026-02-19

## Objective
Stabilize AI Studio generation reliability by routing every generation surface through one modular runtime path (submit -> retrieve -> persist -> settle), while preserving current user-facing UX and billing contracts.

## Why This Addendum Exists
- Current generation behavior is inconsistent across models/surfaces.
- Some generations remain stuck in `generating...` despite successful provider outputs.
- Credit display can temporarily drop to zero due to in-flight hold rendering behavior, reducing trust.
- Incremental patching has improved components but has not yet restored end-to-end confidence.

This addendum introduces a strict stabilization pivot so implementation work is coherent and measurable.

## Non-Negotiables
- Keep `/api/fal/*` contracts backward-compatible.
- Keep billing reservation/capture/release semantics unchanged and idempotent.
- Keep current AI Studio loading/spinner/queued UX behavior unchanged during stabilization.
- No new external infrastructure.
- No big-bang rewrite.

## Stabilization Strategy
Use a strangler-style migration, not a full rebuild:
- Build one authoritative generation runtime contract.
- Move model quirks into model profiles only.
- Migrate and verify model families in controlled order.
- Keep kill switch and shadow/canary controls available at all times.

## Runtime Contract (Target)
Single runtime input:
- generation intent (tool/mode/model/prompt/reference inputs/resolution/duration/aspect/audio/settings)

Single runtime output:
- normalized submit result (`requestId`, provider/model/profile)
- normalized retrieval state (`pending|running|success|fail`)
- normalized media result URLs (or typed failure code)
- persistence outcome and billing settlement trace

Single allowed implementation path:
- submit engine + retrieval engine + state machine + persistence trigger

## Phase Plan

### S0: Traceability Baseline (Golden Path Scope)
Tasks:
- [x] Add deterministic generation trace IDs spanning submit/status/persist/billing.
- [x] Add one local admin/debug view for a generation timeline by `requestId`/`generationId`.
- [ ] Capture baseline for one model path (`FLUX.2 Lite`) from click to reference-grid materialization.

Exit gates:
- [ ] Can inspect one generation lifecycle end-to-end without ad-hoc log digging.
- [ ] Root failure stage can be identified within 2 minutes for test runs.

### S1: Runtime Boundary Lock
Tasks:
- [ ] Introduce one runtime entrypoint for all AI Studio generate actions.
- [ ] Disallow new bespoke route/surface generation logic.
- [ ] Ensure model-specific behavior is profile-driven only.

Exit gates:
- [ ] All new generation code paths use runtime entrypoint.
- [ ] No unowned per-model logic added outside runtime/profile modules.

### S2: Golden Path Migration (FLUX.2 Lite)
Tasks:
- [ ] Wire `FLUX.2 Lite` submit/status/persist through runtime only.
- [ ] Validate parity for request payload, status handling, media extraction, and billing settlement.
- [ ] Run repeated local/staging runs with deterministic pass/fail report.

Exit gates:
- [ ] Golden path generations consistently return to Reference Grid.
- [ ] No credit/billing regression for golden path.
- [ ] No UX regressions for spinner/placeholder/queued behavior.

### S3: Family Rollout (Profile-by-Profile)
Tasks:
- [ ] Migrate Seedream + Nano Banana family to runtime path.
- [ ] Migrate Flux family to runtime path.
- [ ] Migrate video families (Seedance/Kling/Veo/Sora) to runtime path.
- [ ] Keep shadow parity checks while each family is onboarding.

Exit gates:
- [ ] Each family passes submit->retrieve->persist->billing matrix.
- [ ] No unresolved stuck-generation regressions in canary window.

### S4: Billing UI Clarity (Presentation Layer)
Tasks:
- [ ] Keep backend billing logic unchanged.
- [ ] Redesign AI Studio credit display into `Total`, `Reserved/Holds`, `Available`, `Estimated cost`.
- [ ] Ensure generate enable/disable uses deterministic `available >= estimate`.

Exit gates:
- [ ] No temporary false-zero balance states in tested flows.
- [ ] Generate button state remains stable under concurrent in-flight generations.

## Test Matrix (Required)
For each migrated model profile:
- [ ] Submit payload correctness (model-specific fields).
- [ ] Request id ownership and billing linkage.
- [ ] Status alias/result alias retrieval.
- [ ] Media extraction and normalization.
- [ ] Persistence completion and dedupe behavior.
- [ ] Reference Grid delivery without stuck spinner.
- [ ] Failure code mapping and retry path.

## Rollout Controls
- Keep `SHORTPULSE_FAL_INTEGRATION_MODE=legacy|shadow|on`.
- Keep per-model allowlist gates.
- Keep immediate rollback path to `legacy`.

## Definition Of Done
- One runtime entrypoint handles all AI Studio generation surfaces.
- No bespoke model/surface polling or settlement paths remain.
- Stuck-generation incidents are reduced to defined SLO thresholds.
- Credit display behavior is reliable and explainable under in-flight load.
