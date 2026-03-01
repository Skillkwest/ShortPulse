# ShortPulse Unified Decision Log

Last updated: 2026-03-01

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
