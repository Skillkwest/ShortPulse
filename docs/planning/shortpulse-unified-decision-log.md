# ShortPulse Unified Decision Log

Last updated: 2026-03-02

## Decision 001
- Topic: Auth trust boundary.
- Decision: Token-first fail-closed; proxy headers are non-authoritative metadata.
- Effective phase: 02.

## Decision 002
- Topic: Queue/recovery baseline.
- Decision: `036`, `037`, `038` are baseline; only residual integrity/hardening remains.
- Effective phase: 03.

## Decision 003
- Topic: Queue-status route role.
- Decision: Transitional dispatch kick allowed temporarily, end-state read-only status route.
- Effective phase: 04.

## Decision 004
- Topic: Migration ordering.
- Decision: Kie migration is blocked until auth/runtime/security/billing/admin gates are complete.
- Effective phase: 11.

## Decision 005
- Topic: Modularization scope.
- Decision: Targeted hotspot extraction only; no broad rewrites.
- Effective phases: 06-07.

## Decision 006
- Topic: Documentation obligations.
- Decision: Every phase requires plan doc, tracker update, evidence packet, and relevant SOP/API/ADR updates.
- Effective phases: 00-12.

## Decision 007
- Topic: Research discipline.
- Decision: Targeted research only when external contracts are authoritative, with evidence note.
- Effective phases: 01-12.

## Decision 008
- Topic: Phase sequencing override for runtime canary.
- Decision: Phase 04 canary/signoff is deferred; downstream implementation phases may continue in parallel with explicit tracker notation, while final program closeout still requires Phase 04 completion.
- Effective phases: 04-12.

## Decision 009
- Topic: Phase 11 windowed checkpoint decisioning.
- Decision: Shadow/canary promote/hold decisions must use explicit UTC-window SQL (`check_phase11_shadow_canary_gate_summary_windowed.sql`) and UTC guard script gates; rolling 24h SQL output is informational only.
- Effective phases: 11-12.

## Decision 010
- Topic: Pre-canary acceleration execution track.
- Decision: Continue non-canary implementation and evidence closure work across downstream phases while canary/signoff windows remain deferred; do not treat deferred windows as engineering blockers, and do not execute early checkpoint decisions.
- Effective phases: 04-12.

## Decision 011
- Topic: Operator-managed closure tasks timing.
- Decision: Phase 00 credential-rotation evidence and Phase 01 branch-protection evidence are explicitly deferred to a later operator window while engineering implementation continues.
- Effective phases: 00-01.

## Decision 012
- Topic: Cross-plan consolidation governance.
- Decision: Consolidated incoming plan streams are executed under new `Phase 13` using canonical unified docs only; no parallel tracker/matrix systems are allowed.
- Effective phase: 13.

## Decision 013
- Topic: Migration collision prevention for cross-plan rollout.
- Decision: Migration numbers `041`-`046` are centrally reserved and must be assigned only through `docs/planning/migration-number-reservation-map.md` before SQL PRs open.
- Effective phase: 13.

## Decision 014
- Topic: Recovery exhaustion hardening policy.
- Decision: Running-state recovery exhaustion is gated by both attempt budget and generation minimum-age threshold; when attempts are exhausted before min-age, runtime defers exhaustion and preserves retry eligibility instead of failing early.
- Effective phases: 11, 13.

## Decision 015
- Topic: Controlled webhook canary cohort gating.
- Decision: Webhook callback registration remains on the existing `/api/fal/webhook` route but is cohort-gated via env allowlists (`SHORTPULSE_FAL_WEBHOOK_CANARY_USER_ALLOWLIST`, `SHORTPULSE_FAL_WEBHOOK_CANARY_MODEL_ALLOWLIST`); non-canary traffic continues on polling/reconciler safety paths.
- Effective phases: 11, 13.

## Decision 016
- Topic: Autosave policy enforcement authority.
- Decision: `user_preferences.media_autosave_enabled` is the single preference source for autosave policy; recovery execution must enforce it server-side at completion-time (autosave OFF => settle success without background media persistence), while manual save remains always allowed.
- Effective phase: 13.

## Decision 017
- Topic: Agent message identity prerequisite.
- Decision: Wave E requires stable message IDs at hook-generation time (`useAiAgent`) before any structured generate-callback payload, bubble-media linkage, or inline assistant-edit workflows can be enabled.
- Effective phase: 13.
