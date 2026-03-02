# Unified Phase 13: Cross-Plan Master Rollout

Status: In Progress  
Owner: Engineering

## Objective
Execute the consolidated cross-plan rollout with strict anti-overlap controls, high-value-only scope filtering, and regression-safe slice gates.

## In Scope
1. Consolidated governance lock for incoming plans (runtime hardening, adaptive stabilization, autosave policy, session persistence, safety control plane, and AI Studio UX/prompt-adjacency updates).
2. Migration reservation and sequencing controls through `048_*`.
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
15. Wave E Pass 9 client remote-shadow write-through foundation:
   - added authenticated client API seam (`sessionApiClient.ts`) for `/api/ai/sessions/save`,
   - added transport seam (`sessionShadowPersistence.ts`) that persists local shadow first and mirrors to server only when `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED=true`,
   - updated write-shadow hook to forward `keepalive` intent on lifecycle-triggered flushes,
   - wired page write-shadow persistence through transport seam without changing restore behavior,
   - added focused client transport and hook regression tests.
16. Wave E Pass 8 runtime SQL security gate execution:
   - executed `sql/check_runtime_sql_security_audit.sql` post-rollout remediation,
   - confirmed audit summary `total_checks=102`, `passing_checks=102`, `failing_checks=0`,
   - recorded operational execution evidence in phase-13 packet.
17. Wave E Pass 10 restore-candidate readiness (no hydration cutover):
   - added authenticated client read helper for `/api/ai/sessions/:sid`,
   - added local+remote restore-candidate resolver seam with freshest-snapshot selection by `updatedAt`,
   - added default-off restore-candidate hook (`NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED`),
   - added telemetry-only page wiring for candidate-load observability without mutating workspace state.
18. Wave C Pass 1 operational settlement closeout:
   - applied migration-041 settlement recapture semantics in target environment,
   - executed one-time released-conditional success recapture backfill (`captured=34`),
   - revalidated settlement integrity (`missing_charge_count=0`, `duplicate_charge_key_count=0`) and runtime SQL security audit (`102/102/0`).
19. Wave E Pass 11 hydration apply (gated):
   - added snapshot hydration normalizer seam (`sessionSnapshotHydrator`) with focused tests,
   - added `useAiStudioState` hydration entrypoint (`hydrateFromSessionSnapshot`),
   - added page-level one-shot hydration apply path gated by `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED` (default OFF),
   - kept restore-candidate and restore-apply controls independently toggled for staged rollout.
20. Wave E Pass 12 agent transcript/input hydration (gated):
   - extended session hydration payload normalization with `agent` state (`messages`, `input`, `latestAgentPrompt`, `promptOrigin`, `chatModeEnabled`) including malformed-row filtering and message-id normalization,
   - added `useAiAgent.replaceMessages` seam for explicit restored transcript replacement,
   - added bridge-level hydration seam (`hydrateFromSessionAgentSnapshot`) to keep page orchestration thin and avoid coupling restore logic to UI components,
   - extracted restore-candidate logging + apply orchestration into `useAiStudioSessionRestoreHydration` to keep `pages/ai-studio.tsx` within size-budget policy,
   - hydration apply now restores workspace/output + agent transcript/input in one one-shot flow per `sid`, still guarded by `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED` (default OFF).
21. Wave E Pass 13 staged restore rollout gating:
   - added independent agent-hydration gate (`NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED`) so workspace/output restore apply and transcript/input restore can be promoted separately,
   - extended hydration telemetry with `agent_hydration_applied` for promote/hold decision evidence windows,
   - kept one-shot per-`sid` semantics and fail-closed default gate posture.
22. RCP-3 safety-control pre-rollout checkpoint complete:
   - locked provider safety/error normalization matrix (dev diagnostics vs production normalized user-lane behavior),
   - locked hard-floor incident rollback/cooldown trigger contract for Wave F implementation.
23. Wave F Phase 0 governance artifacts published:
   - added `ai-studio-agent-safety-control-plane-plan.md` and `ai-studio-agent-safety-control-plane-tracker.md`,
   - added ADR `0028-agent-safety-control-plane-and-modality-profiles.md` for durable architecture lock.
24. Wave F Pass 1 runtime policy core:
   - added modality-aware safety policy core modules (`types`, category/profile catalogs, hard floors, decision engine, provider-error policy),
   - integrated policy seams into `studioAgentCoordinator`, `legacyImageDescribeService`, and safety post-process flow with default behavior preserved,
   - added focused runtime/unit/API regression coverage and completed lint/type-check/test gates.
25. Wave F Pass 2 modality wiring:
   - expanded task-submission safety policy seam from image-only to image+video payload resolution,
   - replaced hardcoded Veo/Seedance safety payload branches in video submission handlers with shared policy resolver wiring,
   - added modality submission regression locks (`safetyPolicy` + payload matrix) and passed targeted test/lint/type-check gates.
26. Migration reservation collision correction:
   - detected existing `045`/`046` Character QuickSwap migrations already landed in chain,
   - remapped safety control-plane SQL reservations to `047_*` (persistence) and `048_*` (grant hardening/audit parity),
   - updated reservation/decision/tracker docs to prevent cross-stream migration collisions before Wave F Pass 3 SQL work.
27. Wave F Pass 3 control-plane persistence + admin APIs (implementation slice):
   - added migrations `047_add_agent_safety_policy_control_plane.sql` and `048_harden_agent_safety_policy_control_plane_grants.sql` (+ `047` rollback),
   - added control-plane diagnostics script (`sql/check_agent_safety_policy_control_plane.sql`) and expanded runtime SQL security audit expected-function set for safety RPCs,
   - added admin control-plane endpoints (`/api/admin/agent-safety-policy/active|activate|rollback`) with auth/cooldown validation tests and green lint/type/docs gates.
28. Wave F Pass 4 observability + auto-rollback (implementation slice):
   - expanded runtime safety telemetry fields (`policy_version`, `profile_id`, `modality`, `category`, `decision_action`, `decision_source`, `provider_blocked`, `hard_floor_violation`, `rollback_triggered`) in `studio-agent` and `describe-image` paths,
   - added hard-floor incident auto-rollback executor seam with production + flag gating (`STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED`) and bounded cooldown reuse (`STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS`),
   - wired policy-only rollback trigger on hard-floor incidents and added focused regression coverage for telemetry and rollback gating.

Pending:
1. Wave C Pass 4 observation windows (2 consecutive green windows) and go/no-go decision evidence.
2. Wave D staging behavior matrix closeout (`ON/OFF x generated/upload/paste x image/video`) and promote/hold decision evidence.
3. Wave E remaining passes (promote/hold evidence windows and gate closeout).
4. Wave F integrated validation window closeout and Waves G-H (`RCP-4 pending`).

## Surgical Research Checkpoints (Required)
1. RCP-1: browser lifecycle/autosave transport reliability. Status: complete (`2026-03-02-phase-13-rcp-1-browser-lifecycle-save-strategy.md`).
2. RCP-2: Supabase RLS + `SECURITY DEFINER` + upsert/prune semantics. Status: complete (`2026-03-02-phase-13-rcp-2-supabase-rls-security-definer-upsert-pruning.md`).
3. RCP-3: provider safety/error normalization contracts. Status: complete (`2026-03-02-phase-13-rcp-3-provider-safety-error-normalization.md`).
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
