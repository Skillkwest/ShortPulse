# Create/Pulse workflow production proof closeout

Date: 2026-06-19

## Lane

- Lane id: `create-pulse-workflow-production-proof-2026-06-04`
- Source handoff: `docs/agents/copperknot/handoffs/2026-06-04-create-pulse-workflow-production-proof.md`
- Launch system: `Create and Pulse workflow`
- Execution status: `findings packet complete; authenticated browser proof still blocked`
- Production target: `https://www.shortpulse.ai`
- Production freshness: route parity resolved deployment `shortpulse-l7d8cjqfs-kirk-artmans-projects.vercel.app`, created `2026-06-20T02:04:19.530Z`, with `174` route entries inspected.

## Scope

- Systems touched: Create and Pulse workflow proof only.
- Files changed by this run: this closeout report only.
- Source files changed: none.
- UI, UX, intended behavior, billing, credits, deploy, release state, and right-rail authority: unchanged.
- Credit-consuming generation proof: not run.

## Evidence Snapshot

- Branch: `production`
- Allowed branch config: `production`
- Worktree: dirty before this run with active docs, AI Studio, media, pricing, provider, and Create-adjacent changes. This run treated dirty files as ownership-boundary evidence and did not patch them.
- Handoff freshness: the source handoff already contained a `2026-06-19` freshness addendum. This run did not edit that handoff.
- Evidence quality: local source inspection plus local focused tests plus production-safe unauthenticated route checks. This is not authenticated production workflow proof.

## Standard Proof

- Source inspection confirms `/api/ai/studio-agent-standard` rejects Pulse-shaped payloads, Pulse context, Pulse session namespaces, and inbound `canonicalPrompt` before forcing `runtimeMode: "standard"`.
- Source inspection confirms Standard transport posts only to `/api/ai/studio-agent-standard` and stamps `runtimeMode: "standard"`.
- Source inspection confirms Standard runtime uses a non-overridable `ai-studio:<session>::standard` namespace and rejects session-namespace overrides.
- Source inspection confirms Standard send strips Pulse context, excludes passive right-rail selection from automatic Standard agent input, and keeps previous prompt memory scoped to Standard session memory.
- Local route/runtime proof passed in `frontend/tests/api/studio-agent.runtime.test.ts` at `1` file / `48` tests.

## Pulse Proof

- Source inspection confirms `/api/ai/studio-agent-pulse` requires Pulse context, requires a Pulse session namespace, requires non-empty matching context/namespace preset ids, rejects inbound `canonicalPrompt`, rejects Standard runtime payloads, and rejects retired preset ids before forcing `runtimeMode: "pulse"`.
- Source inspection confirms Pulse transport posts only to `/api/ai/studio-agent-pulse` and stamps `runtimeMode: "pulse"`.
- Source inspection confirms Pulse runtime uses `ai-studio:<session>::pulse:<preset>:<sessionInstance>` namespace authority, allows override only for Pulse activation, and hydrates saved Pulse runtime only when workspace preset/session authority matches runtime preset/session authority.
- Source inspection confirms Pulse send blocks when no active Pulse session exists, strips generic prompt continuity, sends `previousPrompt: null`, requires Pulse context, guards required image-intake steps, and captures Pulse workflow session state only on the Pulse path.
- Local route/runtime proof passed in `frontend/tests/api/studio-agent.runtime.test.ts` at `1` file / `48` tests.

## Generate CTA Proof

- `npm -C frontend run check:generate-cta-contract` passed.
- Source inspection confirms Standard includes Standard chat-mode, Generate CTA, model/aspect, character, style, and primary-submit controls through the Standard runtime result builder and `StandardCreatePropertiesPanel`.
- Source inspection confirms Pulse excludes Standard chat-mode/direct-generation controls and passes Pulse preference, saved Chats, preset activation, and restart contracts through the Pulse runtime result builder.
- Focused Create/Pulse component/runtime tests passed at `14` files / `127` tests.

## Prompt/Reference Composition Proof

- Standard local source inspection confirms Standard composer text is the generation prompt source, with chat-mode direct controls hidden while chat mode is active and assistant-message `use as prompt` explicitly moving assistant text back into the visible composer.
- Standard local source inspection confirms image/prompt attachments are composer-owned and passive right-rail selection does not automatically become Standard agent input.
- Pulse local source inspection confirms Pulse starts from active preset/session authority, keeps the visible Standard composer unchanged, and preserves Pulse prompt/workflow/session authority inside Pulse runtime state.
- ADR 0083 remains respected: `Reference Grid`, `Quick Slot Inventory`, and `Canvas` stay workspace-global across Standard and Pulse; only mode-owned runtime state is isolated.
- Authenticated production prompt/reference composition remains unproven in this run because no browser-control/authenticated-session tool was available in the current tool contract.

## Production-Safe Checks

- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` passed against deployment `shortpulse-l7d8cjqfs-kirk-artmans-projects.vercel.app`.
- `node scripts/verify_internal_route_runtime.mjs --base-url https://www.shortpulse.ai --skip-auth --route generation_recovery --route user_health_fleet --route media_derivatives` passed with unauthenticated `401` for all three protected internal routes.
- Direct unauthenticated production probes returned `401` for:
  - `POST /api/ai/studio-agent-standard`
  - `POST /api/ai/studio-agent-pulse`

## Validation Commands

- `npm -C frontend run test -- tests/api/studio-agent.runtime.test.ts`
  - Passed; `1` file / `48` tests.
- `npm -C frontend run test -- features/ai-studio/components/create/__tests__/StandardCreatePropertiesPanel.single-mode.test.tsx features/ai-studio/components/create/__tests__/PulseCreatePropertiesPanel.test.tsx features/ai-studio/components/create/__tests__/PulseCreatePanelView.test.tsx features/ai-studio/components/create/__tests__/CreatePulsePresetPanel.test.tsx features/ai-studio/hooks/__tests__/useAiStudioCreatePanelRuntime.test.ts features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePrimarySubmit.test.ts features/ai-studio/createRuntime/standardPanel/__tests__/standardCreatePrimaryActionPolicy.test.ts features/ai-studio/createRuntime/__tests__/sessionAgentHydrationBoundary.test.ts features/ai-studio/hooks/createAgentRuntime/__tests__/pulseRuntimeState.test.ts features/ai-studio/hooks/agentOrchestration/__tests__/createAgentOrchestrationRuntimePolicy.test.ts features/ai-studio/hooks/agentOrchestration/__tests__/pulsePresetStart.test.ts features/ai-studio/hooks/createPulsePageRuntime/__tests__/useCreatePulsePresetPageRuntime.test.ts features/ai-studio/hooks/taskSubmission/__tests__/submitInvariants.test.ts features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts`
  - Passed; `14` files / `127` tests.
- `npm -C frontend run check:generate-cta-contract`
  - Passed.
- `npm -C frontend run type-check`
  - Passed.
- `npm -C frontend run lint`
  - Passed with `0` errors / `11` warnings. Warnings are outside this lane and were not patched.
- `npm -C frontend run docs:check`
  - Passed.
- `git diff --check`
  - Passed.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`
  - Passed; `174` route entries inspected.
- `node scripts/verify_internal_route_runtime.mjs --base-url https://www.shortpulse.ai --skip-auth --route generation_recovery --route user_health_fleet --route media_derivatives`
  - Passed.
- Direct unauthenticated production POST probe for Standard/Pulse agent routes.
  - Passed expected fail-closed behavior with `401`.

## Self-Audit Findings

- No narrow Create/Pulse source regression was found in the inspected route, transport, runtime identity, orchestration, runtime-result, panel, or task-submission seams.
- The already-dirty worktree contains active Create-adjacent and AI Studio-adjacent files, including the source handoff. This run did not edit those files.
- The local tests exercise the intended Standard/Pulse split more strongly than the stale handoff counts: current focused fanout is `127` tests rather than the older `114`/`125` count in earlier artifacts.
- Production-safe checks prove route existence, forbidden-route absence, and unauthenticated fail-closed behavior. They do not prove authenticated UI behavior, assistant response quality, Pulse activation success, saved Chats restore, or generation output delivery.

## Issues Fixed During Self-Audit

- None. No in-scope source regression was found, and patching dirty adjacent files would have violated the ownership boundary.

## Issues Intentionally Left Out Of Scope

- Authenticated production browser smoke: blocked by current tool/session availability in this run.
- Credit-consuming generation smoke: approval-gated by the handoff and not run.
- Existing lint warnings: outside this Create/Pulse proof lane.
- Existing dirty AI Studio/media/provider/pricing/doc changes: treated as active ownership-boundary evidence and left untouched.

## Residual Risk

- Standard Create authenticated UI behavior remains unproven on production for the current deployment.
- Pulse activation, Pulse transcript/session namespace behavior, saved Chats restore, and Standard/Pulse switching remain unproven in authenticated production UI.
- Prompt/reference composition is locally tested and source-inspected but not production-proven in an authenticated browser session.
- Any real generation smoke would consume credits and remains approval-gated.

## Recommended Copperknot Readiness Decision

Keep `Create and Pulse workflow` at `Below Floor - Handoff Ready` with evidence `Locally Tested` plus refreshed production-safe route/fail-closed proof.

Recommended score effect: `no score change`.

Rationale: the local contract and production route surface are current and healthy, but the handoff's actual done state requires authenticated production workflow proof. This run did not provide that proof and therefore should not lift readiness.

Next proof before readiness movement:

- Use an authenticated production browser session to verify Standard mode composer and Generate CTA behavior.
- Verify Standard Chat Mode hides direct Create controls while chat is active.
- Verify Pulse mode activates a Pulse without mutating the visible Standard composer.
- Verify Pulse sends route through `/api/ai/studio-agent-pulse`.
- Verify switching Standard/Pulse preserves mode isolation while keeping the global right rail shared.
- If a generation smoke is still needed after those checks, request explicit approval for the smallest credit-consuming test.
