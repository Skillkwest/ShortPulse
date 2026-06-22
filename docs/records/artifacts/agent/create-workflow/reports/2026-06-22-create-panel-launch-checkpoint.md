# Create Panel Launch Checkpoint

Date: `2026-06-22`
Owner surface: `Create Workflow`
Repo branch: `production`
Allowed branch: `production`
Launch queue consumer: `Copperknot`

## Purpose

Preserve the current Create panel audit, source-hardening, and proof boundary so future launch passes do not reopen Create panel source work without fresh evidence.

## Current Decision

Create panel source work is checkpointed as code-side complete for the issues audited in this lane. The remaining high-ROI work is production proof after deploy, not additional local Create panel patching.

This is not a full production-ready claim. No new production browser smoke, deploy verification, credit-consuming generation, or authenticated customer task-completion proof was run for this checkpoint.

## Source Of Truth

- Current Create owner docs:
  - `docs/agents/Create Workflow/create-panel-operating-brief.md`
  - `docs/agents/Create Workflow/create-panel-system-map.md`
- Current Copperknot launch queue:
  - `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- Current canonical source:
  - `frontend/features/ai-studio/components/create/PulseCreatePropertiesPanel.tsx`
  - `frontend/features/ai-studio/components/create/PulseCreatePanelView.tsx`
  - `frontend/features/ai-studio/hooks/useAiStudioCreateModeRuntime.ts`
  - `frontend/features/ai-studio/runtime/createAgentBoundary.ts`
  - `frontend/app/api/ai/studio-agent-standard/route.ts`
  - `frontend/app/api/ai/studio-agent-pulse/route.ts`
  - `frontend/app/api/ai/create-pulse-builtins/route.ts`

## Issues Covered

1. Pulse activation busy-state gap
   - Source fix: `PulseCreatePropertiesPanel` now passes `agentUiBusy || agentTransportSending || agentIsSending` into `PulseCreatePanelView` as `isPulseActivationBusy`.
   - Regression guard: `PulseCreatePropertiesPanel.test.tsx` asserts activation locks while UI-side startup work is busy.
   - UX contract preserved: the visible Pulse rail and composer behavior stay the same; the fix only prevents duplicate activation during startup work.

2. Create route/API path drift risk
   - Source audit: active Create client paths remain bounded to `/api/ai/studio-agent-standard`, `/api/ai/studio-agent-pulse`, and `/api/ai/create-pulse-builtins`.
   - Protected behavior: Standard and Pulse routes remain distinct, Pulse context remains rejected by the Standard route, Pulse route calls remain preset-bound, and built-in Pulse catalog prewarm remains intentional.
   - No route additions, route removals, billing behavior changes, persistence contract changes, or security/privacy posture changes were made.

3. Create panel user-experience friction
   - Source audit: the current panel keeps the Standard/Pulse split understandable, preserves the quieter Pulse composer, protects the user from mid-start duplicate actions, and leaves the existing layout and right-rail contracts intact.
   - Remaining UX risk: usefulness, task completion, save/reopen, and prompt/output quality still need authenticated production proof; they are not proven by local source tests.

## Validation

Focused local validation from the Create panel hardening pass:

- `npm run test -- PulseCreatePropertiesPanel PulseCreatePanelView CreatePulsePresetPanel useCreatePulsePresetPageRuntime useAiStudioAgentOrchestration pulsePresetStart sessionAgentHydrationBoundary useCreatePulseBuiltInCatalog`
  - Passed: `9` files / `121` tests.
- `npm run test -- createAgentBoundary studio-agent.runtime auth-guarded-ai-routes`
  - Passed: `4` files / `77` tests.
- `git diff --check` on scoped Create files passed.

The second test command emitted a duplicate native-class warning from `canvas` and `sharp-libvips`; tests still passed and the warning is outside Create source ownership.

## Protected Contracts

- Do not merge Standard and Pulse runtime paths.
- Do not remove the built-in Pulse catalog prewarm without a product decision; it is intentional readiness work.
- Do not add fallback or legacy Create agent paths.
- Do not change credit, billing, persistence, storage, right-rail, or auth semantics from this lane.
- Do not redesign the Create panel as part of source hardening; current UI/UX is the launch baseline unless fresh evidence proves it cannot launch.

## Copperknot Boundary

Copperknot should not spend another source-hardening pass on the Create panel unless new production, authenticated workflow, customer-task, or regression evidence contradicts this checkpoint.

Next valid Copperknot work is deploy-aware production proof:

- confirm the deployed source includes the Pulse activation busy lock and active-session persistence hardening;
- rerun the authenticated Pulse leave/return contract against `https://www.shortpulse.ai`;
- run a non-credit Standard/Pulse task-completion smoke where possible;
- run credit-consuming generation proof only with explicit approval.

