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
- Decision: Migration numbers `041`-`048` are centrally governed through `docs/planning/migration-number-reservation-map.md`; safety control-plane SQL was remapped to `047`/`048` because `045`/`046` are already implemented by Character QuickSwap migrations.
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

## Decision 028
- Topic: Session hydration-apply rollout boundary.
- Decision: Wave E hydration apply is enabled only behind `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED` (default OFF) and applies once per `sid`; initial scope is workspace/output restoration plus chat-mode/prompt-origin alignment.
- Effective phase: 13.

## Decision 029
- Topic: Session hydration agent-state restoration contract.
- Decision: When restore-apply is enabled, hydration applies normalized agent transcript/input state through dedicated seams (`useAiAgent.replaceMessages` and `useAiStudioAgentBridge.hydrateFromSessionAgentSnapshot`) instead of page-local mutation, preserving modular boundaries and one-shot-per-`sid` semantics.
- Effective phase: 13.

## Decision 030
- Topic: Staged restore rollout gate split.
- Decision: Session restore apply remains governed by `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED`, and agent transcript/input hydration is independently gated by `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED` so workspace/output restore and agent restore can be promoted on separate evidence windows.
- Effective phase: 13.

## Decision 031
- Topic: Provider safety/error normalization contract for safety control rollout.
- Decision: Wave F must enforce a normalized user-lane contract across providers: production safety blocks map to canonical refusal payloads, transient upstream failures map to stable assistant fallback copy, auth/invalid-request failures remain explicit hard errors, and development diagnostics are controlled independently from production user responses.
- Effective phase: 13.

## Decision 032
- Topic: Agent-response tuning knob sequencing.
- Decision: Tunable agent-response safety controls (modality profiles, provider error mode, rollout profile switching) are introduced only in Wave F via the safety control-plane execution path; earlier waves remain behavior-preserving foundations and must not add ad hoc tuning knobs.
- Effective phase: 13.

## Decision 033
- Topic: Wave F runtime safety policy-core authority.
- Decision: Safety action resolution for agent/describe post-process and provider-error normalization now routes through dedicated `safetyPolicy/*` modules (decision engine + provider-error policy), with fail-closed defaults (`prod_safe_v1`, production-normalized provider error mode) and no default behavior drift.
- Effective phase: 13.

## Decision 034
- Topic: Wave F modality submission safety seam authority.
- Decision: AI Studio submission safety payload decisions for Veo/Seedance image+video routes are resolved only through `hooks/taskSubmission/safetyPolicy.ts`; hardcoded handler-level safety branches are removed, and parity is enforced by submission payload matrix tests.
- Effective phase: 13.

## Decision 035
- Topic: Wave F control-plane persistence and admin operation boundary.
- Decision: Safety control-plane state transitions are executed only through service-role `SECURITY DEFINER` RPCs (`get_active_agent_safety_policy`, `activate_agent_safety_policy`, `rollback_agent_safety_policy`) and admin-authenticated API routes under `/api/admin/agent-safety-policy/*`; direct client-side policy-plane writes are not allowed.
- Effective phase: 13.

## Decision 036
- Topic: Wave F staging parity deferment and Wave G continuation.
- Decision: Wave F staging admin-API observation gate is deferred until staging alias deployment parity includes the Wave F admin route bundle; Wave G local/code-gated implementation is allowed to proceed in parallel under canonical Phase 13 tracking.
- Effective phase: 13.

## Decision 037
- Topic: Wave G prompt-adjacency normalization seam authority.
- Decision: Chat-off create prompt resolution and agent-output generate request parsing must route through shared `promptAdjacency` logic seams (`resolveChatOffCreatePrompt`, `normalizeAgentOutputGenerateRequest`) with legacy string payload compatibility retained and no route/API envelope expansion.
- Effective phase: 13.

## Decision 038
- Topic: Wave H canary threshold and decision authority.
- Decision: Wave H promote/hold/rollback outcomes must use explicit UTC-window SQL gate summaries and evaluator output with locked thresholds (`duplicate_settlement_count=0`, `duplicate_media_persistence_count=0`, `unresolved_no_media_percent<0.1`, `recovery_success_percent>=99` when sample > 0), and promotion requires two consecutive `PASS` windows.
- Effective phase: 13.

## Decision 039
- Topic: Wave H operator window packet freeze authority.
- Decision: Wave H H2 execution must use only the frozen window packet (`canary-1: 2026-03-01 18:46:07+00 -> 2026-03-02 18:46:07+00`, `canary-2: 2026-03-02 18:46:07+00 -> 2026-03-03 18:46:07+00`) and the canonical command chain (`phase11_shadow_checkpoint_gate.sh`, `check_phase11_shadow_canary_gate_summary_windowed.sql`, `phase11_evaluate_gate_summary.mjs`); ad hoc window boundary edits are not allowed during the active decision cycle.
- Effective phase: 13.

## Decision 040
- Topic: Temporary Wave-H/Phase-13 closeout deferment lock.
- Decision: Remaining Phase 13 operational windows and closeout execution steps (Wave H H2/H3 and linked evidence windows) are paused as of `2026-03-02` and deferred into a consolidated full repo-wide sweep window targeted for `2026-03-06` (UTC), with no threshold-contract edits allowed during the hold.
- Effective phase: 13.

## Decision 041
- Topic: Wave F staging safety-control operational deferment.
- Decision: As of `2026-03-03`, remaining Wave F staging execution items are explicitly deferred to a later operator window: staging alias parity rerun, staging manual no-sim route matrix, and staging promote/hold/rollback decision packet. Local implementation and contract gates remain accepted as complete for this job.
- Effective phase: 13.
