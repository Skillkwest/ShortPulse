# Create/Pulse workflow production proof closeout

Date: 2026-06-17

## Lane

- Lane id: `create-pulse-workflow-production-proof-2026-06-04`
- Source handoff: `docs/agents/copperknot/handoffs/2026-06-04-create-pulse-workflow-production-proof.md`
- Launch system: `Create and Pulse workflow`
- Execution status: `partial proof complete; authenticated browser proof blocked`
- Production target: `https://www.shortpulse.ai`
- Production freshness: route parity resolved deployment `shortpulse-qydi14q1v-kirk-artmans-projects.vercel.app`, created `2026-06-17T13:50:27.284Z`

## Scope

- Systems touched: Create and Pulse workflow proof only.
- Files changed by this run: this closeout report only.
- Source files changed: none.
- UI, UX, intended behavior, billing, credits, deploy, and release state: unchanged.
- Credit-consuming generation proof: not run.

## Standard Proof

- Source inspection confirms `/api/ai/studio-agent-standard` rejects Pulse-shaped payloads, Pulse context, Pulse session namespaces, and inbound `canonicalPrompt` before forcing `runtimeMode: "standard"`.
- Source inspection confirms Standard send strips Pulse context before context submission and excludes passive right-rail selection from automatic Standard agent input.
- Local route/runtime proof passed in `tests/api/studio-agent.runtime.test.ts`, including Standard runtime prompt resolution, `gpt-5.5` default coverage, Responses/web-search lane behavior, prompt-artifact classification, attachment serialization, safety refusal mapping, and Standard/Pulse route-boundary cases.

## Pulse Proof

- Source inspection confirms `/api/ai/studio-agent-pulse` requires Pulse context, a Pulse session namespace, non-empty context and namespace preset ids, matching context/namespace preset ids, no inbound `canonicalPrompt`, and no retired preset ids before forcing `runtimeMode: "pulse"`.
- Source inspection confirms Pulse send blocks when no active Pulse session exists, strips generic prompt continuity, requires Pulse context, guards required image-intake steps, and captures Pulse workflow session state on the Pulse path.
- Local route/runtime proof passed in `tests/api/studio-agent.runtime.test.ts`, including Pulse runtime execution, built-in instruction control-plane override behavior, next-turn built-in instruction refresh, and no generic canonical prompt persistence from Pulse.

## Generate CTA Proof

- `npm -C frontend run check:generate-cta-contract` passed.
- Focused Create/Pulse component/runtime tests passed for Standard and Pulse panel contracts, including Generate CTA separation and Pulse agent-only panel behavior.

## Prompt/Reference Composition Proof

- Source inspection confirms Standard and Pulse use separate runtime result builders:
  - Standard result includes Standard chat-mode, Generate CTA, model/aspect, character, style, and primary-submit controls.
  - Pulse result excludes Standard chat-mode/direct-generation controls and passes Pulse preference/chat-history/preset restart contracts instead.
- Local focused fanout passed task-submission invariants and submission payload matrix tests.
- Production authenticated prompt/reference composition remains unproven because the controllable browser session was unauthenticated.

## Production-Safe Checks

- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` passed.
- Unauthenticated production probes returned `401` for:
  - `POST /api/ai/studio-agent-standard`
  - `POST /api/ai/studio-agent-pulse`
  - `POST /api/openai/image-generate`
- Browser observation at `https://www.shortpulse.ai/ai-studio` reached the sign-in screen, not an authenticated AI Studio session.

## Validation Commands

- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`
  - Passed; `175` route entries inspected.
- `node` unauthenticated production POST probe for Standard, Pulse, and OpenAI image generation routes.
  - Passed expected fail-closed behavior with `401`.
- `npm -C frontend run check:generate-cta-contract`
  - Passed.
- `npm -C frontend run test -- tests/api/studio-agent.runtime.test.ts --reporter=dot`
  - Passed; `1` file / `48` tests.
- `npm -C frontend run test -- features/ai-studio/components/create/__tests__/StandardCreatePropertiesPanel.single-mode.test.tsx features/ai-studio/components/create/__tests__/PulseCreatePropertiesPanel.test.tsx features/ai-studio/components/create/__tests__/PulseCreatePanelView.test.tsx features/ai-studio/components/create/__tests__/CreatePulsePresetPanel.test.tsx features/ai-studio/hooks/__tests__/useAiStudioCreatePanelRuntime.test.ts features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePrimarySubmit.test.ts features/ai-studio/createRuntime/standardPanel/__tests__/standardCreatePrimaryActionPolicy.test.ts features/ai-studio/createRuntime/__tests__/sessionAgentHydrationBoundary.test.ts features/ai-studio/hooks/createAgentRuntime/__tests__/pulseRuntimeState.test.ts features/ai-studio/hooks/agentOrchestration/__tests__/createAgentOrchestrationRuntimePolicy.test.ts features/ai-studio/hooks/agentOrchestration/__tests__/pulsePresetStart.test.ts features/ai-studio/hooks/createPulsePageRuntime/__tests__/useCreatePulsePresetPageRuntime.test.ts features/ai-studio/hooks/taskSubmission/__tests__/submitInvariants.test.ts features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts --reporter=dot`
  - Passed; `14` files / `125` tests.

## Self-Audit Findings

- No Create/Pulse source regression was found in the inspected route, orchestration, or runtime-result seams.
- The current worktree is dirty with many unrelated active media/provider/docs changes. This run did not patch those files and did not treat their state as Create/Pulse proof.
- The production route surface is current and fail-closed for unauthenticated Create/Pulse routes.
- The required authenticated browser workflow proof is still missing because the available browser session is not signed in.

## Residual Risk

- Standard Create authenticated UI behavior remains unproven on production for the current deployment.
- Pulse activation, transcript/session namespace behavior, saved Chats restore, and Standard/Pulse switching remain unproven in authenticated production UI.
- Prompt/reference composition is locally tested but not production-proven.
- Any real generation smoke would consume credits and remains approval-gated.

## Recommended Copperknot Readiness Decision

Keep `Create and Pulse workflow` at `Below Floor - Handoff Ready` with evidence `Locally Tested` plus fresh production route/fail-closed proof.

Do not lift readiness until an authenticated production smoke verifies:

- Standard mode shows the expected Standard composer and Generate CTA behavior.
- Standard Chat Mode hides direct Create controls while chat is active.
- Pulse mode activates a Pulse without mutating the visible Standard composer.
- Pulse sends route through `/api/ai/studio-agent-pulse`.
- Switching Standard/Pulse preserves mode isolation while keeping the global right rail shared.
- Any credit-consuming generation proof is explicitly approved before execution.

