# Unified Phase 13: Cross-Plan Master Rollout

Status: In Progress  
Owner: Engineering

## Objective
Execute the consolidated cross-plan rollout with strict anti-overlap controls, high-value-only scope filtering, and regression-safe slice gates.

## In Scope
1. Consolidated governance lock for incoming plans (runtime hardening, adaptive stabilization, autosave policy, session persistence, safety control plane, and AI Studio UX/prompt-adjacency updates).
2. Migration reservation and sequencing controls through `046_*`.
3. Wave-based execution with explicit pass/fail gates, rollback notes, and evidence requirements.
4. Mandatory targeted research checkpoints before externally coupled implementation slices.

## Out of Scope
1. Broad architecture rewrites.
2. Duplicate tracker/matrix systems outside existing canonical unified docs.
3. Combined mega-release or undocumented migration changes.

## High-Value Filter
A slice is implementation-eligible only if it directly improves:
1. Billing/settlement correctness.
2. Runtime recovery reliability.
3. Security boundary/access control.
4. Deterministic user-work persistence.
5. Existing failing-gate stabilization.

## Wave Plan
1. Wave A: governance lock + baseline evidence.
2. Wave B: adaptive gate stabilization (`ReferenceGrid.curated` failures only).
3. Wave C: runtime hardening Slice C pass 0-3.
4. Wave D: autosave policy foundation.
5. Wave E: agent identity + session persistence.
6. Wave F: safety control plane.
7. Wave G: consolidated UX + prompt-adjacency rollout.
8. Wave H: controlled webhook canary + closeout.

## Current Update (2026-03-02)
Completed:
1. Wave A governance lock:
   - phase-13 stage doc and evidence scaffolding created,
   - migration reservation map added,
   - canonical unified docs updated (master plan/tracker/overlap matrix/decision log).
2. Wave B adaptive gate stabilization:
   - updated two failing `ReferenceGrid.curated` fixtures to trusted Supabase-style URLs,
   - `test:adaptive-v2-gate` is green.
3. Wave C Pass 1 foundation:
   - migration `041_harden_released_reservation_recapture_semantics.sql`,
   - settlement policy seam extraction (`settlementPolicy.ts`) and wiring in `settlementService.ts`,
   - `sql/check_generation_settlement_integrity.sql`,
   - focused runtime policy test coverage.
4. Wave C Pass 2/3 implementation:
   - runtime flags added: `recovery_probe_timeout_ms` and `running_exhaust_min_age_seconds`,
   - timeout-aware probe wrapper (`recoveryFetchWithTimeout.ts`) wired into recovery probe dispatch paths,
   - running-state exhaustion now requires attempts + min-age threshold (with deferred-exhaustion retry safety),
   - migration `042_harden_queue_recovery_rpc_execute_grants.sql` added for queue/recovery RPC execute-grant hardening,
   - `sql/check_runtime_sql_security_audit.sql` expanded to include queue/recovery enqueue/claim RPC signatures,
   - `sql/check_phase11_shadow_canary_metrics.sql` queue-dispatch telemetry now reports explicit error sources (`claim_failed`, `retry`, `exhausted`) instead of wildcard source matching.
5. Wave C Pass 4 canary controls implementation:
   - webhook callback registration now supports cohort scoping by env allowlists (user/model),
   - no new route surface was added; `/api/fal/webhook` remains the only webhook ingress route,
   - polling/reconciler safety path remains active for all non-canary traffic.
6. Wave D autosave policy foundation implementation:
   - added migration `043_add_user_preferences_media_autosave_enabled.sql` (+ rollback) and bootstrap parity for `user_preferences`,
   - introduced shared autosave policy seam (`mediaAutosavePolicy.ts`) used by both client orchestration and server recovery execution,
   - wired server recovery enforcement to settle success without persistence when autosave is OFF, including decision metadata and decision events,
   - added client autosave preference + orchestration hooks and idempotent duplicate-save reconciliation for manual persistence,
   - updated generated-video reference-card save action parity.
7. Wave E Pass 1 message identity foundation:
   - `useAiAgent` now guarantees IDs for hook-generated user/assistant messages,
   - added message update seam (`updateMessageById`) for targeted assistant bubble mutation without history rewrites,
   - message-store tests and agent hook tests updated to lock ID and update behavior.
8. Wave E Pass 2 structured generate callback payload:
   - output-generate callbacks now pass `{ messageId, prompt, source }` from chat surfaces,
   - page boundary keeps compatibility shim for legacy string callback input,
   - callback contract threaded through create/prompt/shell hook composition layers.
9. Wave E Pass 3 bubble thumbnail linkage:
   - introduced `useAgentOutputBubbleLinking` to map assistant message IDs to optimistic output IDs and resolve `pending/ready/failed` bubble media states,
   - `handleGenerate` now returns `{ accepted, optimisticOutputId }` so page orchestration can register post-submit message-output links without route contract changes,
   - threaded `assistantBubbleMedia` through inline and expanded chat surfaces and rendered thumbnail/status UI above generate pills,
   - added focused hook, generation-controller, and agent-panel regression coverage.
10. Wave E Pass 4 inline assistant edit wiring:
   - added local-only assistant edit callback contracts (`onAssistantMessageEdit`) through create/inline/expanded chat surfaces,
   - introduced `messageEditing.ts` helper seam for normalization + no-op commit rejection,
   - wired bridge-level edit commits via existing `useAiAgent.updateMessageById` with targeted telemetry,
   - implemented double-click inline edit UX in `AgentChatPanel` (Enter/blur commit, Escape cancel, drag disabled while editing),
   - gated behavior by `NEXT_PUBLIC_ENABLE_AGENT_BUBBLE_INLINE_EDIT` at page orchestration for default-safe rollout.
11. Wave E Pass 5 chat mode toggle + raw-submit behavior:
   - added local chat-mode preference seam (`chatModePreference.ts`) with default ON and legacy raw-mode storage fallback handling,
   - threaded `chatModeEnabled` through bridge/panel/prompt contracts so chat-mode state remains decoupled from page orchestration,
   - added right-of-composer `Chat Mode` toggle using the same toggle classes/visual behavior as Character Mode controls,
   - enforced behavior split: Chat Mode ON keeps agent send/respond flow; Chat Mode OFF disables chat-send affordances and routes primary Create/Text submit through direct raw prompt generation (`agentInput` fallback to shared prompt).
12. Wave E Pass 6 session identity URL-contract foundation:
   - added strict session identity helpers (`sessionIdentity.ts`) for `sid` UUID parse/validation/generation,
   - added `useAiStudioSessionIdentity` hook to enforce valid `?sid=<uuid>` on `/ai-studio` via shallow replace when query is missing/invalid,
   - wired hook at page entry with no generation-runtime behavior changes,
   - added focused utility/hook tests for valid/invalid/missing query behavior.
13. Wave E Pass 7 session write-shadow local-durability foundation:
   - added schema-versioned snapshot serializer seam (`sessionSnapshot.ts`) covering workspace/output/agent state payloads for persistence,
   - added local shadow storage seam (`sessionSnapshotStorage.ts`) using IndexedDB-first persistence with in-memory fallback,
   - added write-shadow orchestrator hook (`useAiStudioSessionWriteShadow`) with debounce + max-dirty timers and lifecycle flush triggers (`visibilitychange(hidden)`, `pagehide`),
   - wired `/ai-studio` page orchestration to persist local write-shadow snapshots keyed by `sid`,
   - added focused serializer and hook integration tests.
14. Wave E Pass 8 session SQL/API foundation:
   - added migration `044_add_ai_studio_sessions_persistence.sql` (+ rollback) with `ai_studio_sessions` table, RLS policies, and service-role-only `SECURITY DEFINER` RPCs (`upsert/get/list/prune`),
   - added server helper seam (`aiStudioSessions.ts`) for session id/snapshot validation, cursor encode/decode, and RPC interactions,
   - added authenticated AI session APIs (`/api/ai/sessions/save`, `/api/ai/sessions/:sid`, `/api/ai/sessions`) with route-level flag gate (`SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED`),
   - expanded runtime SQL security audit expected-function set for new session RPCs,
   - added focused helper/API auth route test coverage.

Pending:
1. Wave C Pass 4 observation windows (2 consecutive green windows) and go/no-go decision evidence.
2. Wave D staging behavior matrix closeout (`ON/OFF x generated/upload/paste x image/video`) and promote/hold decision evidence.
3. Wave E remaining passes (client write-through to server persistence APIs and restore hydration by `sid`).
4. Waves F through H.

## Surgical Research Checkpoints (Required)
1. RCP-1: browser lifecycle/autosave transport reliability. Status: complete (`2026-03-02-phase-13-rcp-1-browser-lifecycle-save-strategy.md`).
2. RCP-2: Supabase RLS + `SECURITY DEFINER` + upsert/prune semantics. Status: complete (`2026-03-02-phase-13-rcp-2-supabase-rls-security-definer-upsert-pruning.md`).
3. RCP-3: provider safety/error normalization contracts.
4. RCP-4: Fal/Kie canary threshold and webhook/status contract tuning.

## Required Deliverables
1. Updates in canonical docs only:
   - `docs/planning/shortpulse-unified-buildout-master-plan.md`
   - `docs/planning/shortpulse-unified-buildout-tracker.md`
   - `docs/planning/shortpulse-unified-overlap-matrix.md`
   - `docs/planning/shortpulse-unified-decision-log.md`
2. Migration allocation in `docs/planning/migration-number-reservation-map.md`.
3. Evidence notes under `docs/planning/evidence/unified-buildout/phase-13/`.

## Exit Criteria
1. All Wave A-H gates pass with evidence links.
2. Required docs, SOPs, and route/schema references are updated at each applicable gate.
3. No duplicate implementation tracks and no unresolved migration numbering collisions.

## Rollback Policy
1. Roll back per-slice only; do not program-wide rollback unless explicitly required.
2. Prefer feature-flag disablement first for behavior rollback.
3. Pair migration rollback scripts where feasible; otherwise apply targeted corrective forward SQL and document rationale.
