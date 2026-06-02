# Standard Mode Capability Plan V1

Date: 2026-06-02
Owner: Pulse
Scope: AI Studio Create Standard-mode agent capability upgrades only
Mode: planning only, no product-code behavior changes in this document

## Purpose

Define the safest high-ROI implementation plan for making Standard mode a stronger and more useful agent without creating UI churn, breaking Create behavior, or blurring the Standard/Pulse boundary.

This plan assumes the prior modularization work is already in place and uses the current Standard seams instead of creating new parallel systems.

## User Constraints

This plan is explicitly shaped by the current task constraints:

- no major UI changes
- do not break existing Create behavior
- prefer high-ROI implementation changes
- avoid messy refactors, duplicate paths, fallback systems, or speculative infrastructure

## Core Recommendation

Build `v1` in the existing Standard lane. Do not introduce a third-party memory product for this phase.

The best next implementation path is:

1. `Standard memory v1`
2. `Standard server instruction and context assembly v1`
3. `Standard response quality v1`
4. `Standard eval suite v1`

This order keeps the work mostly inside Standard-owned runtime, transport, and memory seams before touching presentation.

## Source Of Truth

Implementation and proof for this plan should anchor to these current seams:

- `frontend/features/ai-studio/createRuntime/standardMemory/`
- `frontend/features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts`
- `frontend/features/ai-studio/hooks/agentOrchestration/runStandardCreateAgentSend.ts`
- `frontend/features/ai-agent/useCreateAgentStateCore.ts`
- `frontend/features/ai-agent/client/standardResponseContract.ts`
- `frontend/features/agent-runtime/standardStudioAgentRuntime/runtime.ts`
- `frontend/features/ai-agent/logic/standardContextBuilder.ts`
- `frontend/pages/api/ai/studio-agent-standard.ts`
- `frontend/pages/api/admin/agent-instructions/standard-system-prompt.ts`
- `frontend/features/admin/components/AdminAgentInstructionsSection.tsx`

Boundary and persistence constraints:

- `docs/adr/0070-project-workspace-conversational-runtime-exclusion.md`
- `docs/adr/0083-create-mode-global-right-rail-authority.md`
- `docs/sops/sop_ai_studio_pulse_mode.md`
- `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`

## Zero-Drift Rules

These rules apply to all phases in this plan unless the user explicitly rewrites them later:

- no major visible UI redesign
- no Standard chat-mode semantic changes
- no change to visible-composer generation ownership
- no silent assistant-to-composer prompt replacement
- no Pulse runtime changes
- no Pulse parking, restore, preset, or hidden-context changes
- no right-rail ownership changes
- no project-workspace persistence expansion unless separately approved
- no third-party memory integration in `v1`

## No-Touch List For Early Slices

Avoid changing these surfaces unless a tiny adapter is required and the behavior stays identical:

- `frontend/features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx`
- `frontend/features/ai-studio/components/PromptStep.tsx`
- `frontend/features/ai-studio/components/promptStep/StandardPromptStepChatSurface.tsx`
- `frontend/features/ai-studio/components/promptStep/CreateChatRichMessageBody.tsx`
- Pulse runtime files
- global right-rail state files

## Shared-Core Caution

Some of the highest-ROI Standard fixes pass through shared code, especially:

- `frontend/features/ai-agent/useCreateAgentStateCore.ts`
- `frontend/features/ai-agent/client/messageStore.ts`
- `frontend/features/ai-studio/hooks/useAiStudioCreatePanelRuntime.ts`

That is allowed only when the change is:

- clearly required for the Standard seam
- narrower than adding a second implementation path
- proven not to change Pulse behavior or non-Standard Create behavior

If a shared-core change cannot meet those conditions, stop and redesign the slice at the Standard-owned boundary instead of pushing deeper into shared code.

## Product Contract Decisions

### 1. Session memory boundary

Recommended `v1` stance:

- Standard memory is session-scoped
- memory survives normal in-session continuity and session snapshot restore where already supported
- memory does not become durable project-workspace long-term memory in this phase

### 2. Prompt continuity

Recommended `v1` stance:

- the last accepted prompt should become first-class Standard working state
- it should not rely on indirect recap text alone
- it must not silently override the visible composer

### 3. Output contract

Recommended `v1` stance:

- the visible assistant answer remains primary
- optional reusable artifacts remain separate and explicit
- richer output quality should come from better Standard context assembly and reply policy before renderer expansion

### 4. Formatting scope

Recommended `v1` stance:

- keep the current Standard visual surface mostly intact
- improve answer quality within the current formatting envelope first
- delay broader markdown renderer expansion unless the evals prove it is the highest-ROI next step

## Phase Plan

### Phase 0. Proof Surface Lock

Goal:
Pin the current Standard proof surface before capability work starts.

In scope:

- identify the current Standard tests that protect memory, response contract, send path, route boundary, and panel invariants
- add missing narrow tests only where a coming phase would otherwise be under-proven

Out of scope:

- product behavior changes
- new capabilities

Proof gate:

- there is a named Standard proof set for memory, response, runtime, and boundary behavior
- current Standard/Pulse isolation is covered
- visible-composer generation ownership is covered

Named proof set for Phase 0:

- `frontend/features/ai-studio/createRuntime/standardMemory/__tests__/standardSessionMemory.test.ts`
- `frontend/features/ai-agent/client/__tests__/messageStore.test.ts`
- `frontend/features/ai-agent/client/__tests__/standardResponseContract.test.ts`
- `frontend/features/ai-agent/client/__tests__/standardTransportResultResolution.test.ts`
- `frontend/features/ai-agent/__tests__/useAiAgent.test.ts`
- `frontend/features/ai-agent/__tests__/createAgentBoundary.test.ts`
- `frontend/features/ai-studio/createRuntime/__tests__/useStandardCreateAgentRuntime.test.ts`
- `frontend/features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePrimarySubmit.test.ts`
- `frontend/features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePanelProps.test.ts`
- `frontend/features/ai-studio/components/create/__tests__/StandardCreatePropertiesPanel.single-mode.test.tsx`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioCreatePanelRuntime.test.ts`
- `frontend/features/ai-studio/logic/__tests__/sessionSnapshot.test.ts`
- `frontend/features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`
- `frontend/tests/api/studio-agent.runtime.test.ts`

### Phase 1. Standard Memory V1

Goal:
Turn Standard memory from a lightweight recap into a real session-memory contract.

Implementation targets:

- make `last accepted prompt` explicit Standard working state
- define a structured Standard working-state object
- keep a bounded recent transcript window instead of relying on raw replay alone
- keep a compact session summary for earlier relevant context
- support selective retrieval of older session facts only when relevant

Suggested working-state fields:

- `userGoal`
- `currentTask`
- `constraints`
- `decisionsMade`
- `openQuestions`
- `referencesInPlay`
- `latestDeliverable`
- `lastAcceptedPrompt`
- `nextBestAction`
- `status`

Preferred file lane:

- `frontend/features/ai-studio/createRuntime/standardMemory/`
- `frontend/features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts`
- `frontend/features/ai-studio/hooks/agentOrchestration/runStandardCreateAgentSend.ts`
- `frontend/features/ai-agent/useCreateAgentStateCore.ts`

Out of scope:

- cross-session durable memory
- vector databases
- third-party memory tools
- UI redesign

Proof gate:

- Standard outbound turns include explicit working-state memory, not recap text alone
- prompt continuity no longer depends on indirect summary fallback
- longer chats keep the right constraints and decisions more reliably
- no Create UI or generation-semantics drift

### Phase 2. Standard Server Instruction And Context Assembly V1

Goal:
Improve Standard answer quality by making the server compose better Standard context before the model responds.

Implementation targets:

- create a Standard-owned instruction/context assembler on the server
- use more of the existing Standard context already available from the client
- keep the admin-managed Standard prompt as the authority base, then compose runtime context around it
- keep Pulse and Standard fully isolated

High-ROI context candidates:

- active prompt state
- focused source
- mode hint
- last assistant message
- selected reference intent
- memory summary and working state

Preferred file lane:

- `frontend/features/agent-runtime/standardStudioAgentRuntime/runtime.ts`
- `frontend/features/ai-agent/logic/standardContextBuilder.ts`
- `frontend/pages/api/ai/studio-agent-standard.ts`

Out of scope:

- admin UI redesign
- Pulse instruction changes
- tool-calling loops
- hidden multi-step autonomous workflows

Proof gate:

- Standard answers show better context retention without UI changes
- the live Standard control-plane prompt remains the server authority
- route and mode isolation remain intact

### Phase 3. Standard Response Quality V1

Goal:
Make Standard replies more useful, coherent, and agentic within the existing product surface.

Implementation targets:

- improve reply policy for brainstorming, refining, deciding, and prompt-writing turns
- preserve explicit separation between visible answer and optional prompt artifact
- add a lightweight hidden verify and revise pass only when the turn is high-value or constraint-dense
- keep answers readable and calm instead of over-structured

Preferred file lane:

- `frontend/features/agent-runtime/standardStudioAgentRuntime/runtime.ts`
- `frontend/features/ai-agent/client/standardResponseContract.ts`

Out of scope:

- broad markdown renderer work
- major panel interaction changes
- hidden autonomous tool loops

Proof gate:

- Standard replies score better on usefulness and constraint retention
- prompt artifacts remain explicit and separate
- ordinary turns do not become slower or more rigid without benefit

### Phase 4. Standard Eval Suite V1

Goal:
Create a compact but real eval and regression surface for Standard capability work.

Implementation targets:

- define a small set of representative Standard conversations
- score memory retention, usefulness, coherence, and artifact correctness
- add boundary cases for refusals, longer chats, conflicting asks, and formatting requests
- use this eval surface to decide whether later renderer work is justified

Preferred eval categories:

- memory continuity
- constraint retention
- answer usefulness
- answer coherence across turns
- explicit artifact correctness
- refusal correctness
- Standard/Pulse boundary safety

Out of scope:

- giant benchmark infrastructure
- speculative general-purpose eval framework work

Proof gate:

- Standard has a named repeatable eval set for the capability lane
- the eval set can detect regressions from future memory or response changes

## Recommended Implementation Order

For minimal mess and highest ROI, execute in this exact order:

1. Phase 0 proof surface lock
2. Phase 1 memory contract and prompt continuity
3. Phase 2 server instruction and context assembly
4. Phase 3 response quality improvements
5. Phase 4 eval suite hardening

Do not start renderer expansion, durable memory, or broader Create-panel behavior work unless this plan is complete and the eval results point there.

## Suggested First Implementation Slice

Start with:

`Phase 0 plus the first half of Phase 1`

That first slice should do only these things:

- pin the Standard proof surface
- promote `last accepted prompt` into explicit Standard working state
- stop dropping prompt continuity in the shared send core
- keep all visible behavior unchanged

Why this first:

- it is the highest-ROI quality improvement already visible from the current repo
- it strengthens memory without requiring UI work
- it makes later summary and retrieval work much cleaner

### First Slice Execution Packet

Target outcome:

- preserve all visible Standard behavior
- make `lastAcceptedPrompt` explicit Standard working state
- stop losing prompt continuity in the Standard send/core path

Preferred file lane for the first slice:

- `frontend/features/ai-studio/createRuntime/standardMemory/standardSessionMemory.ts`
- `frontend/features/ai-studio/createRuntime/standardMemory/standardMemorySummary.ts`
- `frontend/features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts`
- `frontend/features/ai-studio/hooks/agentOrchestration/runStandardCreateAgentSend.ts`
- `frontend/features/ai-agent/useCreateAgentStateCore.ts`
- `frontend/features/ai-agent/client/messageStore.ts`
- related Standard-only tests from the Phase 0 proof set

First-slice no-touch reminder:

- do not change Standard panel rendering files
- do not change `CreateChatRichMessageBody.tsx`
- do not change Standard chat-mode semantics
- do not change generate-button or composer UX semantics
- do not change admin UI behavior

First-slice stop gate:

- Standard prompt continuity no longer depends on summary fallback alone
- tests in the first-slice proof surface pass
- no intentional UI, UX, or generation-semantics drift is introduced
- Standard/Pulse boundary behavior remains intact

## Validation Surface

At minimum, each phase should prove against the relevant Standard test lanes:

- Standard memory tests
- Standard response contract tests
- Standard send/runtime tests
- Standard route boundary tests
- Standard panel invariant tests where behavior-preservation matters

If a phase changes server response composition, include targeted behavioral tests at the Standard route/runtime seam.

Recommended Phase 0 command groups:

1. Memory and response contract proof
   `npm -C frontend run test -- features/ai-studio/createRuntime/standardMemory/__tests__/standardSessionMemory.test.ts features/ai-agent/client/__tests__/messageStore.test.ts features/ai-agent/client/__tests__/standardResponseContract.test.ts features/ai-agent/client/__tests__/standardTransportResultResolution.test.ts`

2. Runtime, boundary, and panel invariants
   `npm -C frontend run test -- features/ai-agent/__tests__/useAiAgent.test.ts features/ai-agent/__tests__/createAgentBoundary.test.ts features/ai-studio/createRuntime/__tests__/useStandardCreateAgentRuntime.test.ts features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePrimarySubmit.test.ts features/ai-studio/hooks/standardCreateRuntime/__tests__/useStandardCreatePanelProps.test.ts features/ai-studio/components/create/__tests__/StandardCreatePropertiesPanel.single-mode.test.tsx features/ai-studio/hooks/__tests__/useAiStudioCreatePanelRuntime.test.ts features/ai-studio/logic/__tests__/sessionSnapshot.test.ts features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts tests/api/studio-agent.runtime.test.ts`

## Stop Condition

This plan is complete when:

- Phases 0 through 4 are implemented and verified
- Standard is stronger in session memory and answer quality
- there have been no intentional major UI changes
- Standard/Pulse isolation still holds
- visible-composer generation ownership still holds
- no adjacent cleanup lane has been started by momentum

Once those are true, stop. Do not continue into renderer expansion, long-term memory, or broader agent-platform work unless the user explicitly starts a new plan.

## What This Plan Explicitly Avoids

- third-party memory adoption before it is needed
- Create-panel redesign
- major renderer work before quality bottlenecks are proven
- cross-mode abstractions
- storing Standard memory as project-workspace durable history
- speculative multi-agent behavior in Standard mode

## Recommendation

This is the cleanest high-ROI path:

- fix Standard memory continuity first
- improve Standard server context assembly second
- improve Standard answer quality third
- harden with evals before touching broader presentation

That sequence gives the best chance of making Standard meaningfully smarter without creating a mess.
