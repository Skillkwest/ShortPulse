# Next-Agent Handoff: Create And Pulse Workflow Production Proof

## Lane Id

`create-pulse-workflow-production-proof-2026-06-04`

## Copy/Paste Use

- This packet is intended for the Pulse/Create Workflow owner, with Copperknot review.
- Execution authorization: the Pulse/Create Workflow owner should work through this lane. Start with production-safe authenticated proof/inspection, then implement a narrow source fix only if that proof finds a concrete Create/Pulse regression.
- Do not redesign Create, Pulse, the composer, the right rail, or generation behavior.

## Current Freshness Addendum - 2026-06-19

- Current queue state: P4 `Create and Pulse workflow` is `Below Floor - Handoff Ready` with `Locally Tested` evidence.
- This packet remains handoff-ready for the Pulse/Create Workflow owner when paired with the current queue row. Current July 7 launch-state language in this addendum controls.
- Current local repo has active dirty AI Studio/Create-adjacent work from other lanes. Refresh `git status --short` as the first step, identify owner overlap, then work clean/assigned files only.
- Remaining proof boundary: production-safe authenticated Standard/Pulse workflow behavior, with any credit-consuming generation proof explicitly approved. Preserve current UI/UX/design/behavior and do not alter Generate CTA semantics.

## Current Freshness Addendum - 2026-06-25

- Current queue state: P4 `Create and Pulse workflow` remains `Below Floor - Task Completion Unproven` with the custom-Pulse persistence sub-boundary at `Production Checked` for failure and `Locally Tested` for source hardening.
- Fresh production target: `https://www.shortpulse.ai` resolves to deployment `shortpulse-muzhv0x34-kirk-artmans-projects.vercel.app`, created `2026-06-25T19:41:57.522Z`; strict route parity passed over `188` route entries, secret exposure passed, and the Supabase transform guard passed locally.
- Fresh production custom Pulse audit still fails after the latest deployed source: `PLAYWRIGHT_BASE_URL=https://www.shortpulse.ai npm run test:e2e:pulse-custom-contract` returned `ok=false` with `persistsOnLeaveCreateVerified=false`.
- Important split: the audit proves auth, real custom Pulse creation, activation and follow-up `/api/ai/studio-agent-pulse` submissions, `runtimeMode="pulse"`, `pulseKind="custom_gpt"`, `source="custom"`, instructions preservation, guided metadata absence, and visible activation/follow-up messages. The remaining failure is the visible UI state after leaving Create for Presets and returning: the panel shows `Choose a Pulse to start`.
- Current source already includes Copperknot's two focused local hardening passes: unresolved custom Pulse sessions are not cleared while the user is outside Create, and active Pulse session identity is forwarded through the Pulse runtime result into rendered panel props. Focused page-runtime, runtime/prop-boundary, touched-file typecheck, and broader Pulse bundle validation are green locally.
- Why Copperknot is stopping now: this is repeated fix/regression churn on the same customer-visible seam. Do not stack another speculative guard. The next owner must instrument/trace the real UI state owner across the tool switch and determine whether the clearing comes from Create mode runtime, Pulse preference/catalog reload, session snapshot hydration, Pulse chat/history restoration, or shell/tool switching.
- Current dirty-worktree warning: `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts` and `frontend/lib/server/projectOutputDisplayItemsService.ts` are dirty from another lane at handoff time. Do not touch them unless the current owner explicitly adopts that lane.

## Why This Task

- Launch system: `Create and Pulse workflow`
- Launch state: `Below Floor - Task Completion Unproven`
- Evidence level: `Production Checked` for the custom-Pulse failure; `Locally Tested` for the latest source hardening
- Human risk: `Critical`
- Operational risk: `High`
- Technical risk: `High`
- Why now: Copperknot found and fixed a narrow Pulse route-boundary source gap where `/api/ai/studio-agent-pulse` did not directly enforce that the Pulse session namespace preset matched `context.pulse.presetId`.
- Why Copperknot is stopping: this is now assigned execution/proof work for the named owner. The remaining done proof requires authenticated production behavior and possibly credit-consuming generation smoke, both outside Copperknot's current autonomy gates.

## Current Copperknot Evidence

- `frontend/pages/api/ai/studio-agent-standard.ts` rejects Pulse-shaped payloads, Pulse context, Pulse session namespaces, and inbound `canonicalPrompt` before Standard runtime execution.
- `frontend/pages/api/ai/studio-agent-pulse.ts` now requires Pulse context, Pulse session namespace, non-empty context and namespace preset ids, matching context/namespace preset ids, no inbound `canonicalPrompt`, and no retired preset ids before Pulse runtime execution.
- `frontend/features/ai-studio/hooks/agentOrchestration/runStandardCreateAgentSend.ts` strips Pulse context from Standard sends and excludes passive right-rail selection from automatic Standard agent input.
- `frontend/features/ai-studio/hooks/agentOrchestration/runPulseCreateAgentSend.ts` strips generic prompt continuity from Pulse sends, requires active Pulse session/context, blocks required image-intake steps without image context, and sends `previousPrompt: null`.
- `frontend/features/ai-studio/createRuntime/buildStandardCreateRuntimeResult.ts` and `frontend/features/ai-studio/createRuntime/buildPulseCreateRuntimeResult.ts` keep Standard Generate/Styles controls and Pulse agent-only panel props on separate contracts.
- `frontend/features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx` exposes the inline Generate CTA only through the Standard panel control set and hides it when Standard Chat Mode is active.
- `frontend/features/ai-studio/components/create/PulseCreatePropertiesPanel.tsx` and `frontend/features/ai-studio/components/create/PulseCreatePanelView.tsx` keep Pulse as an agent composer with no Pulse-only Generate CTA.
- Copperknot added API regression coverage in `frontend/tests/api/studio-agent.runtime.test.ts` for malformed Pulse requests with missing preset ids.
- Current `2026-06-17` Copperknot guardrail cleanup touched `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts` only for formatting/import-budget reduction. No task-submission behavior, route selection, prompt/reference payload rules, UI, or UX was intentionally changed.

## Validation Already Run

- `npm -C frontend run test -- tests/api/studio-agent.runtime.test.ts`
  - `1` file / `45` tests passed.
- `npm -C frontend run check:generate-cta-contract`
  - passed.
- `npm -C frontend run test -- features/ai-studio/components/create/__tests__/StandardCreatePropertiesPanel.single-mode.test.tsx features/ai-studio/components/create/__tests__/PulseCreatePropertiesPanel.test.tsx features/ai-studio/components/create/__tests__/PulseCreatePanelView.test.tsx features/ai-studio/components/create/__tests__/CreatePulsePresetPanel.test.tsx features/ai-studio/hooks/__tests__/useAiStudioCreatePanelRuntime.test.ts features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePrimarySubmit.test.ts features/ai-studio/createRuntime/standardPanel/__tests__/standardCreatePrimaryActionPolicy.test.ts features/ai-studio/createRuntime/__tests__/sessionAgentHydrationBoundary.test.ts features/ai-studio/hooks/createAgentRuntime/__tests__/pulseRuntimeState.test.ts features/ai-studio/hooks/agentOrchestration/__tests__/createAgentOrchestrationRuntimePolicy.test.ts features/ai-studio/hooks/agentOrchestration/__tests__/pulsePresetStart.test.ts features/ai-studio/hooks/createPulsePageRuntime/__tests__/useCreatePulsePresetPageRuntime.test.ts features/ai-studio/hooks/taskSubmission/__tests__/submitInvariants.test.ts features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts`
  - `14` files / `114` tests passed.
- `npm -C frontend run type-check`
  - passed.
- `npm -C frontend run lint`
  - passed with `0` errors and `34` existing warnings.
- `npm -C frontend run test -- --run features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`
  - `1` file / `55` tests passed on `2026-06-17`.
- `npm -C frontend run type-check:touched`
  - passed on `2026-06-17` for the touched AI Studio task-submission file. Repo-wide typecheck still has unrelated diagnostics and was not used as proof for this handoff refresh.
- `npm -C frontend run validate:media-rendering-guardrails`
  - passed on `2026-06-17`; the only remaining output was the known warn-mode `useAiStudioState.ts` size-budget warning.

## Required Context

Read first:

- `AGENTS.md`
- `docs/agents/copperknot/july-7-launch-authority.md`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- `docs/adr/0083-create-mode-global-right-rail-authority.md`
- `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
- `docs/sops/sop_ai_studio_pulse_mode.md`
- `docs/product/shortpulse_ai_studio.md`
- `docs/routes.md`

Inspect first:

- `frontend/pages/api/ai/studio-agent-standard.ts`
- `frontend/pages/api/ai/studio-agent-pulse.ts`
- `frontend/features/agent-runtime/studioAgentRouteModeBoundary.ts`
- `frontend/features/ai-studio/hooks/useAiStudioCreatePanelRuntime.ts`
- `frontend/features/ai-studio/createRuntime/*`
- `frontend/features/ai-studio/hooks/agentOrchestration/*`
- `frontend/features/ai-studio/components/create/*`
- `frontend/features/ai-studio/hooks/taskSubmission/*`

## Scoped Task

Prove or disprove that Create/Pulse workflow behavior is launch-reliable enough for July 7 without changing the current UI, UX, or intended behavior.

Immediate 2026-06-25 focus: diagnose why the production custom Pulse session is still visually inactive after leaving Create for Presets and returning even though the Pulse route/runtime context remains correct. Start from the failing screenshot `/tmp/shortpulse-pulse-custom-contract-failure.png` if available in the active environment, then reproduce with the production audit harness and add targeted local instrumentation/tests around the actual state owner before patching.

Answer:

1. Does production Standard Create preserve Standard-only chat, Generate CTA, prompt/reference composition, and route behavior?
2. Does production Pulse preserve Pulse-only activation, transcript/session namespace, prompt artifact, workflow-session, and `/api/ai/studio-agent-pulse` routing?
3. Do Standard and Pulse avoid leaking prompt, transcript, attachment, active output, right-rail, or canonical prompt state into each other?
4. Can a safe authenticated production smoke prove the non-credit surfaces without spending credits?
5. If credit-consuming generation smoke is needed, what exact minimal approval-gated test would prove it?

## Owned Write Surface

Preferred output is a findings/closeout report only.

Allowed code/docs changes only if a narrow source regression is found:

- `frontend/pages/api/ai/studio-agent-*`
- `frontend/features/agent-runtime/*StudioAgentRuntime/*`
- `frontend/features/agent-runtime/studioAgentRouteModeBoundary.ts`
- `frontend/features/ai-studio/createRuntime/*`
- `frontend/features/ai-studio/hooks/agentOrchestration/*`
- `frontend/features/ai-studio/hooks/useAiStudioCreatePanelRuntime.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/*`
- `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
- `frontend/features/ai-studio/components/create/*`
- directly corresponding tests

## Forbidden Scope

- No UI, UX, visual, or intended behavior changes.
- No right-rail state fork; preserve ADR 0083 global right-rail authority.
- No billing, credit, entitlement, or pricing policy changes.
- No commit, push, deploy, or release-promotion action.
- No destructive data operations.
- No credit-consuming production generation tests without explicit approval.
- No Docker Supabase workflows.
- No secret exposure in logs or reports.
- No Supabase image transformations for any reason.

## Suggested Production Proof

- Confirm the deployed production URL is `https://www.shortpulse.ai`.
- Run production-safe route/runtime checks that do not spend credits.
- If authenticated browser proof is available without exposing secrets, verify:
  - Standard mode shows the current Standard composer and Generate CTA behavior.
  - Standard Chat Mode hides direct Create controls while chat is active.
  - Pulse mode activates a Pulse without mutating the visible Standard composer.
  - Pulse sends route only through `/api/ai/studio-agent-pulse`.
  - Switching Standard/Pulse preserves mode isolation and shared global right-rail behavior.
- If a generation smoke is required, stop for explicit approval and define the smallest credit-consuming proof.

## Done State

Stop when one of these is true:

- Production-safe authenticated proof supports the current local source/test findings, and any remaining credit-consuming proof is named as an approval gate.
- A narrow source regression is fixed and validated, with remaining production proof named.
- Production/authenticated proof is blocked by credentials, target ambiguity, credit cost, or approval boundary, with exact next owner/action named.
- Fresh evidence shows broader Create/Pulse architecture work is needed; stop and create a narrower follow-on handoff instead of continuing by momentum.

## Stop Rules

- Stop immediately if the lane requires UI/UX changes, intended-behavior changes, broad Create/Pulse architecture work, production credential decisions, credit-consuming generation, release/deploy action, or cross-lane right-rail redesign.
- Stop instead of patching if validation begins oscillating or if the source problem spans more than a couple focused passes.
- If no existing owner can complete the proof safely, return a temp-agent handoff recommendation rather than broadening.

## Required Closeout Report

Create:

- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/YYYY-MM-DD-create-pulse-workflow-production-proof-closeout.md`

Required contents:

- lane id
- source handoff path
- execution status
- production target and freshness
- systems touched
- files changed
- Standard proof
- Pulse proof
- Generate CTA proof
- prompt/reference composition proof
- production-safe checks run
- credit-consuming proof requested or explicitly not run
- validation commands
- self-audit findings
- residual risk
- recommended Copperknot readiness decision
