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

## Decision 018
- Topic: Structured output-generate callback transition strategy.
- Decision: Agent output-generate callbacks now use structured payload `{ messageId, prompt, source }`; page boundary must keep a compatibility shim for legacy string payloads until all call sites are migrated.
- Effective phase: 13.

## Decision 019
- Topic: Agent bubble media-linking contract.
- Decision: Bubble thumbnail/status UI is linked by assistant `messageId -> optimisticOutputId` mapping, with generation-controller return payload `{ accepted, optimisticOutputId }` as the only orchestration seam; no server/API route contract changes are introduced for this linkage.
- Effective phase: 13.

## Decision 020
- Topic: Inline assistant bubble edit authority and rollout gate.
- Decision: Assistant bubble edits are local-only mutations applied via `useAiAgent.updateMessageById` with normalization/no-op rejection in a shared helper seam; rollout is fail-closed unless `NEXT_PUBLIC_ENABLE_AGENT_BUBBLE_INLINE_EDIT=true`.
- Effective phase: 13.

## Decision 021
- Topic: Chat Mode naming/default and raw-submit behavior.
- Decision: AI Studio toggle label is `Chat Mode` with default ON; ON preserves existing agent send/respond behavior, OFF disables chat-send affordances and routes primary Create/Text submit through direct raw prompt generation (`agentInput` fallback to shared prompt) without agent rewrite.
- Effective phase: 13.

## Decision 022
- Topic: AI Studio session identity URL contract.
- Decision: `/ai-studio` must carry a valid `sid` UUID query contract; when absent/invalid, client performs shallow URL replacement to inject a new `sid` while preserving in-page state. Plain `/ai-studio` therefore starts a new session identity by default.
- Effective phase: 13.

## Decision 023
- Topic: Session persistence rollout ordering and local write-shadow boundary.
- Decision: Wave E enables local write-shadow durability before restore/server APIs; persistence writes are currently local-only (schema-versioned snapshot + IndexedDB shadow storage + lifecycle flush triggers) and restore hydration remains disabled until later Wave E passes.
- Effective phase: 13.

## Decision 024
- Topic: Session SQL/API security boundary and prune/upsert posture.
- Decision: Wave E session SQL/API uses service-role-only `SECURITY DEFINER` RPCs with explicit `search_path`, strict execute-grant hardening, and atomic upsert+deterministic prune semantics (bounded TTL/cap, per-user advisory lock, last-write-wins monotonic `save_seq`).
- Effective phase: 13.

## Decision 025
- Topic: Session API route surface and rollout gate.
- Decision: Wave E session server surface is fixed to three authenticated endpoints (`POST /api/ai/sessions/save`, `GET /api/ai/sessions/:sid`, `GET /api/ai/sessions`) backed by shared server helpers; rollout remains fail-closed via `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED`.
- Effective phase: 13.

## Decision 026
- Topic: Client remote-shadow transport behavior.
- Decision: Wave E remote session shadow writes are local-first and fail-soft: local IndexedDB persistence remains authoritative, while server mirroring to `/api/ai/sessions/save` is optional (`NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED`) and must not block user flow or trigger hard failure loops.
- Effective phase: 13.

## Decision 027
- Topic: Session restore-candidate staged rollout boundary.
- Decision: Wave E restore sequencing introduces read-only candidate loading behind `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED` (default OFF), selecting freshest snapshot across local shadow and optional remote read by `updatedAt`; workspace hydration apply remains disabled until a later gated pass.
- Effective phase: 13.
