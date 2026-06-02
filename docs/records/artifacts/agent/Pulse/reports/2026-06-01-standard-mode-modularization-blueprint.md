# Standard Mode Agent Modularization Blueprint

Date: 2026-06-01
Owner: Pulse
Scope: AI Studio Create Standard-mode agent architecture only
Mode: planning only, no behavior changes

## Purpose

Define the safest modularization path for turning Standard mode from a prompt-shaped chat helper into a stronger agent subsystem with clear ownership seams for response behavior, memory, rendering, and Create-panel integration.

This blueprint is intentionally architecture-first. It does not propose adding cross-mode sharing, hidden fallback paths, or mixed Standard/Pulse abstractions.

## Current State Summary

Standard mode already has a workable skeleton:

- dedicated route: `frontend/pages/api/ai/studio-agent-standard.ts`
- dedicated server runtime: `frontend/features/agent-runtime/standardStudioAgentRuntime/runtime.ts`
- dedicated client runtime: `frontend/features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts`
- dedicated Standard panel surface: `frontend/features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx`

The main weakness is not lack of code. The weakness is that Standard behavior is split across several layers that still think in prompt-output terms:

- response contract is prompt-centric
- session continuity is snapshot replay, not agent memory
- rendering is a partial rich-text formatter, not a deliberate Standard response renderer
- Create-panel behavior and agent behavior are coupled through shared composer state
- the shared send core is neutral, but Standard policy is spread across orchestration, transport parsing, panel props, and rendering

## Architecture Goal

Create one explicit Standard subsystem with four owned internal contracts:

1. `Standard response contract`
2. `Standard memory contract`
3. `Standard presentation contract`
4. `Standard Create-panel integration contract`

The result should preserve Standard/Pulse isolation while making Standard easier to evolve without regressions.

## Design Principles

- Preserve Standard and Pulse runtime isolation at every layer.
- Keep one canonical owning path per behavior.
- Pull Standard policy out of generic shared code where possible.
- Prefer small adapters around existing code before deep rewrites.
- Separate agent semantics from Create-panel layout concerns.
- Land refactors in behavior-preserving phases with targeted tests.

## Blueprint Audit Update

This plan was audited after initial drafting and tightened in four ways:

- added explicit contract decisions for reply versus prompt-artifact behavior
- added a recommended v1 memory stance
- added a stricter first-slice proof gate and out-of-scope boundary
- added a concrete phase-one test inventory and acceptance checklist

These additions are meant to reduce ambiguity before implementation starts.

## Repo Compatibility Audit

This blueprint was then compared against the current repo contracts, SOPs, ADRs, and test-backed behavior. That comparison adds one more requirement:

- the first modularization slices must be architecture-strengthening changes with zero intentional UI, UX, or workflow behavior deltas outside the explicitly named Standard response-contract goal

Repo-backed constraints that must remain unchanged during the first slices:

- Standard and Pulse stay isolated by route, runtime, transcript, hidden context, and mode-owned runtime authority
- `Reference Grid`, `Quick Slot Inventory`, and `Canvas` remain workspace-global right-rail surfaces
- Standard generation authority stays in the visible composer
- assistant output does not silently become the active generation prompt
- Standard chat-mode UI behavior stays intact, including create-control hiding and collapse of create-owned side surfaces while chat mode is on
- Pulse parking, restore, and preset/runtime behavior stay untouched

These are not just product preferences. They are current repo contracts.

## Zero-Drift Behavior Contract

The following behaviors are treated as non-negotiable invariants for the first implementation slices:

### 1. Visible composer prompt ownership

- the visible Standard composer remains the source of truth for Standard Create generation input
- assistant replies may suggest or expose prompt artifacts, but they must not silently replace the visible composer prompt
- any assistant-to-generation handoff must preserve the current explicit user-facing mechanism

### 2. Standard chat-mode UI behavior

- when Standard chat mode is on, create-only control rows remain hidden
- hidden create-owned surfaces such as model, style, and character adjunct UI continue to close rather than linger visually
- no chat-mode toggle semantics change in the first slices
- no chat-mode default change in the first slices

### 3. Global right-rail authority

- right-rail workspace authority remains shared across Standard and Pulse
- no plan step may fork or reinterpret right-rail state as Standard-only memory

### 4. Pulse isolation and parking behavior

- no first-slice change may alter Pulse parking, restore, preset activation, or hidden runtime ownership
- no Standard refactor may require Pulse UI or runtime edits unless a shared low-level helper must be narrowed in a behavior-preserving way

### 5. Generation pipeline semantics

- the Standard generation path must keep its current visible-composer ownership semantics
- the first slices must not redesign generate routing, task submission, model selection, or provider payload composition

## Recommended Contract Decisions

### Decision 1. Standard reply versus prompt artifact

Recommended stance:

- a Standard assistant turn may contain both:
  - a conversational reply for the user to read
  - an optional prompt artifact for generation workflows
- these are different outputs and must be modeled separately
- a reply must not be inferred to be a prompt artifact just because it is useful text
- a prompt artifact should be explicit, typed, and optional

Why:

- this keeps Standard conversationally capable without losing Create-panel usefulness
- it removes the current ambiguity where many successful turns are treated as prompt output by implication
- it gives richer future replies somewhere to live without breaking Generate behavior

Implementation effect:

- the Standard response contract should expose separate fields for visible reply content and prompt artifact content

### Decision 2. Standard session memory v1

Recommended stance:

- v1 Standard memory should be:
  - recent transcript window
  - compact working summary
  - explicit working state for current user intent and current assistant commitments
- v1 should not attempt durable cross-session long-term memory
- v1 restore may continue using the existing session snapshot path for local continuity

Why:

- transcript alone will get noisy as sessions grow
- summary alone is too lossy for an agent expected to be useful in an active Create session
- explicit working state gives us a clean place to track what Standard thinks it is helping with

Implementation effect:

- the first memory extraction should centralize transcript windowing and define summary and working-state slots even if the first implementation keeps them simple

## First Slice Scope

The first implementation slice is:

`Phase 0 plus Phase 1: freeze the current Standard contract with tests, then extract the Standard response contract without user-visible behavior changes.`

### Explicitly In Scope

- Standard response typing and resolution
- Standard transport-success interpretation
- Standard client runtime consumption of the resolved response contract
- tests needed to protect current Standard behavior while refactoring

### Explicitly Out Of Scope

- Pulse runtime changes
- `/admin/agent-instructions` changes
- server-side persistence redesign
- true markdown expansion
- Standard memory redesign beyond contract scaffolding
- changes to Create generation semantics
- changes to Standard chat-mode UI behavior
- changes to right-rail ownership or right-rail projection behavior
- changes to Standard chat-mode default behavior
- changes to Pulse parking or restore behavior
- telemetry schema redesign

## First Slice Proof Gate

The first slice is complete only when all of the following are true:

1. Standard has a typed response contract in a Standard-owned module.
2. Standard no longer depends on scattered prompt-success heuristics for basic client behavior.
3. No user-visible Standard Create behavior has intentionally changed.
4. Standard/Pulse route and runtime isolation still pass.
5. Existing Standard prompt-artifact behavior still works where currently expected.
6. Visible-composer generation ownership and chat-mode UI behavior still match current repo contracts.

If any of those are not proven, the slice is not done.

## Current Ownership Map

`Route boundary`

- `frontend/pages/api/ai/studio-agent-standard.ts`
- Rejects Pulse payloads and canonical prompt continuity.

`Server execution policy`

- `frontend/features/agent-runtime/standardStudioAgentRuntime/runtime.ts`
- Builds OpenAI messages, appends response style guidance, normalizes success as prompt success.

`Client state core`

- `frontend/features/ai-agent/useCreateAgentStateCore.ts`
- Shared message store, send path, optimistic UI, transport handling.

`Standard client runtime`

- `frontend/features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts`
- Standard-only session namespace, snapshot hydration, chat mode, attachment orchestration.

`Standard send policy`

- `frontend/features/ai-studio/hooks/agentOrchestration/runStandardCreateAgentSend.ts`
- Resolves outbound text, strips Pulse context, merges attachments, calls transport.

`Panel assembly`

- `frontend/features/ai-studio/hooks/useAiStudioCreatePanelRuntime.ts`
- Converts active runtime into Standard panel props.

`Standard UI surface`

- `frontend/features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx`
- `frontend/features/ai-studio/components/PromptStep.tsx`
- `frontend/features/ai-studio/components/promptStep/StandardPromptStepChatSurface.tsx`

`Response rendering`

- `frontend/features/ai-studio/components/promptStep/CreateChatRichMessageBody.tsx`

## Target Module Map

### 1. Standard response contract

Goal: stop treating every successful Standard turn as the same kind of prompt artifact.

Create or consolidate a Standard-owned response contract layer responsible for:

- conversational reply
- prompt artifact
- refusal
- error
- optional follow-up affordances

Recommended ownership:

- keep transport boundary thin
- move Standard-specific response interpretation into a dedicated module near `standardTransportResultResolution.ts`
- define one typed Standard result model consumed by the client runtime and chat UI

Likely file lane:

- `frontend/features/ai-agent/client/standardResponseContract.ts`
- `frontend/features/ai-agent/client/standardTransportResultResolution.ts`

### 2. Standard memory contract

Goal: define what Standard remembers during a session and where that memory lives.

Phase-one memory should stay modest:

- recent transcript window
- compact working summary
- latest useful user intent
- latest useful assistant commitments
- current attached reference intent

This is different from full long-term memory. The first modularization target is policy clarity, not persistence expansion.

Recommended ownership:

- keep UI snapshot restore for local continuity
- introduce a Standard-owned memory model in the client runtime first
- keep server persistence optional until the in-session contract is stable
- avoid piggybacking on `canonical_prompt`, because that storage model is conceptually wrong for Standard conversational memory

Likely file lane:

- `frontend/features/ai-studio/createRuntime/standardMemory/`
- `frontend/features/ai-studio/createRuntime/standardMemory/standardSessionMemory.ts`
- `frontend/features/ai-studio/createRuntime/standardMemory/standardTranscriptWindow.ts`
- `frontend/features/ai-studio/createRuntime/standardMemory/standardMemorySummary.ts`

### 3. Standard presentation contract

Goal: make Standard output rendering a deliberate product surface instead of a lightweight parser side effect.

Recommended ownership:

- define what Standard is allowed to render
- decide whether Standard supports curated markdown or full markdown
- keep Standard restrained and non-Pulse-shaped
- separate parsing from display styling

Likely file lane:

- `frontend/features/ai-studio/components/promptStep/standardPresentation/`
- `standardMessageParser.ts`
- `standardMessageRenderer.tsx`
- `standardMessageFormatPolicy.ts`

`CreateChatRichMessageBody.tsx` can remain temporarily as the implementation surface, but the target is to stop sharing one parsing file as the long-term home for both Standard and Pulse display semantics.

### 4. Standard Create-panel integration contract

Goal: isolate agent logic from panel choreography and generation controls.

Recommended ownership:

- keep Standard agent runtime responsible for Standard agent state
- keep Create-panel runtime responsible for mapping runtime to panel props
- move Standard-specific create-panel decisions into a compact adapter layer
- make chat-mode behavior explicit instead of emerging from mixed prompt/composer state

Likely file lane:

- `frontend/features/ai-studio/createRuntime/standardPanel/`
- `standardCreatePanelContract.ts`
- `standardCreateComposerState.ts`
- `standardCreatePrimaryActionPolicy.ts`

## Recommended Refactor Sequence

## High-ROI Sequencing Rule

The implementation order must favor the highest-value behavioral clarification with the smallest likely blast radius.

Preferred order:

1. response-contract extraction with no UI touch
2. memory-contract extraction with no UI touch
3. presentation extraction behind a no-op adapter
4. panel integration cleanup only when the prior contracts make it necessary

This order is intentional:

- it keeps value concentrated on Standard agent semantics first
- it avoids dragging Create-panel presentation and control behavior into early refactors
- it prevents “cleanup” from turning into UI churn

### Phase 0. Freeze the contract with tests

Goal: protect today’s behavior before moving code.

Add or strengthen tests around:

- Standard route boundary rejection of Pulse payloads
- Standard response parsing behavior
- Standard chat-mode prompt mirroring
- Standard snapshot hydration behavior
- Standard rich rendering behavior
- Standard primary submit behavior in chat mode versus prompt mode

Exit condition:

- enough coverage exists to move modules without blind regressions

Suggested test inventory for Phase 0:

- route boundary:
  - Standard rejects Pulse runtime payloads
  - Standard rejects canonical prompt continuity payloads
- response parsing:
  - success reply with explicit `applyPrompt`
  - success reply without explicit `applyPrompt`
  - refusal reply
  - non-prompt conversational reply
- Create runtime:
  - chat-mode composer mirrors into visible Standard prompt state
  - legacy Standard restore hydrates into visible composer lane
- Create panel behavior:
  - primary submit in chat mode uses visible composer text
  - primary submit in prompt mode uses prompt textarea text
- rendering:
  - restrained Standard formatting remains restrained
  - prompt artifacts still render through the Standard rich renderer when structured

### Phase 1. Extract Standard response policy

Goal: give Standard one typed result model.

Work:

- introduce Standard-specific response shape definitions
- separate “assistant visible reply” from “prompt artifact payload”
- update Standard runtime consumers to depend on the new contract
- keep external API shape unchanged at first

Exit condition:

- Standard no longer relies on prompt-success heuristics being scattered across multiple files
- Standard consumers can reason about reply text and prompt artifact text separately

Acceptance checklist for Phase 1:

- Standard server route behavior unchanged
- Standard client runtime behavior unchanged
- Standard chat history unchanged
- Standard prompt artifact drag/use behavior unchanged
- Standard rich rendering unchanged unless a test explicitly documents an intended no-op normalization
- Standard chat-mode UI behavior unchanged
- Standard visible-composer generate behavior unchanged

### Phase 2. Extract Standard memory policy

Goal: replace raw replay-as-policy with explicit session-memory rules.

Work:

- define Standard session memory inputs
- centralize transcript windowing
- add summary slot abstraction even if initial implementation is pass-through
- keep snapshot restore behavior compatible

Exit condition:

- one module decides what conversational context Standard sends
- no visible Standard panel behavior changed as part of that extraction

### Phase 3. Extract Standard presentation policy

Goal: make richer output safe to improve later.

Work:

- isolate Standard parsing and rendering from Pulse-guided formatting
- define allowed Standard formatting features
- add tests for Standard-specific rendering decisions

Exit condition:

- Standard output formatting can evolve without touching Pulse display semantics
- the initial extraction lands with no visual change before any future renderer expansion is considered

### Phase 4. Clean panel integration seams

Goal: reduce coupling between agent runtime and Create-panel shell behavior.

Work:

- extract Standard composer state adapter
- extract Standard primary action policy
- clarify how chat mode affects Generate, panel controls, and visible prompt ownership

Exit condition:

- panel wiring becomes a thin adapter around clearer Standard runtime modules

### Phase 5. Add stronger agent capabilities

Only after phases 1 through 4:

- add structured session memory behavior
- improve richer markdown support if wanted
- add better conversational planning or follow-up abilities
- consider server-backed session memory only if the client-side contract proves stable

## What Should Stay Shared

These are reasonable shared surfaces as long as they remain policy-light:

- generic message storage utilities
- generic optimistic UI helpers
- transport failure normalization
- attachment preparation primitives
- session key plumbing

The rule is simple: shared code may provide mechanics, but Standard policy should live in Standard-owned modules.

## No-Touch Surfaces For First Slices

Unless a test-backed behavior-preserving adapter absolutely requires otherwise, the first implementation slices should avoid direct edits to:

- `frontend/features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx`
- `frontend/features/ai-studio/components/PromptStep.tsx`
- `frontend/features/ai-studio/components/promptStep/StandardPromptStepChatSurface.tsx`
- `frontend/features/ai-studio/components/promptStep/CreateChatRichMessageBody.tsx`
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts`
- right-rail authority logic and related workspace-global surfaces
- Pulse runtime modules and Pulse Create panel modules

For the first slices, preferred file touch is concentrated in Standard response-resolution/runtime modules and their tests.

## What Should Stop Being Implicit

- whether a Standard reply is a conversation reply or a prompt artifact
- what context Standard includes from prior turns
- what “memory” means for Standard
- what formatting Standard is allowed to use
- when chat-mode text becomes the canonical generation prompt
- which layer owns the last word on Standard panel behavior

## File-Level Blueprint

Recommended target structure:

```text
frontend/features/ai-studio/createRuntime/
  useStandardCreateAgentRuntime.ts
  standardMemory/
    standardSessionMemory.ts
    standardTranscriptWindow.ts
    standardMemorySummary.ts
  standardPanel/
    standardCreatePanelContract.ts
    standardCreateComposerState.ts
    standardCreatePrimaryActionPolicy.ts

frontend/features/ai-agent/client/
  standardResponseContract.ts
  standardTransportResultResolution.ts

frontend/features/ai-studio/components/promptStep/
  standardPresentation/
    standardMessageFormatPolicy.ts
    standardMessageParser.ts
    standardMessageRenderer.tsx
```

This structure is intentionally additive-first. It allows migration into clearer homes before deciding whether to retire older files.

## Migration Guardrails

- Do not merge Standard and Pulse parser or runtime concerns while refactoring.
- Do not add hidden compatibility paths that bypass the new Standard modules.
- Do not convert server-side `canonical_prompt` persistence into fake Standard memory.
- Do not let right-rail passive selection silently become Standard memory.
- Do not expand scope into admin control-plane changes unless a later task explicitly requires it.
- Do not let “no visible behavior changes” become an excuse to leave reply-versus-artifact typing ambiguous inside the new Standard contract.
- Do not let the shared generic client core reclaim Standard policy after extraction.
- Do not fold generation-pipeline cleanup into the Standard response-contract slice.
- Do not use “small UI tidy-ups” as part of the first slices.
- Do not rewrite chat-mode affordances, drag-to-composer semantics, or control visibility during response-contract extraction.

## Validation Plan

For each phase, validate:

- Standard route boundary tests
- Standard client runtime tests
- Standard snapshot hydration tests
- Standard panel prop tests
- Standard rendering tests
- targeted manual Create-panel smoke pass in Standard mode

Suggested proof points:

- Standard still cannot ingest Pulse context
- Standard chat history still restores correctly
- Standard primary Generate behavior stays intact
- Standard rendering stays restrained and readable
- no Pulse tests need semantic changes unless a shared utility contract was intentionally narrowed
- Standard chat-mode control hiding still behaves the same
- right-rail authority remains unchanged

Optional but recommended after Phase 1:

- capture 5-10 representative Standard conversations as a lightweight eval set
- add a tiny telemetry review checklist for:
  - empty response rate
  - reply-without-artifact rate
  - artifact-produced rate
  - refusal rate

## Immediate First Work Package

The first implementation task should be:

`Extract and formalize the Standard response contract without changing user-visible behavior.`

Why this first:

- it is smaller than memory extraction
- it removes the biggest conceptual ambiguity
- it makes later memory and renderer work easier
- it reduces the risk that richer agent replies get incorrectly treated as prompt artifacts

Suggested file touch set for the first work package:

- `frontend/features/ai-agent/client/standardResponseContract.ts`
- `frontend/features/ai-agent/client/standardTransportResultResolution.ts`
- `frontend/features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts`
- `frontend/features/ai-agent/useCreateAgentStateCore.ts`
- targeted tests under:
  - `frontend/features/ai-studio/createRuntime/__tests__/`
  - `frontend/prefabs/agent/panels/__tests__/`
  - route/runtime tests where Standard boundary behavior already lives

Preferred non-touch for the first work package:

- no intended edits to Standard panel rendering files
- no intended edits to generation-controller files
- no intended edits to Pulse runtime files

## Stop Conditions

Pause and reassess if:

- a refactor starts changing Standard/Pulse isolation semantics
- more than one phase is being attempted in the same implementation slice
- tests reveal that a “shared” helper actually contains hidden Pulse assumptions
- the team cannot explain in one sentence whether a given Standard output is a reply, a prompt artifact, or both

## Definition Of Success

This blueprint succeeds if future Standard-mode work can answer four questions quickly and consistently:

1. What is the Standard reply contract?
2. What does Standard remember for the current session?
3. How is Standard output rendered?
4. Which module owns Standard Create-panel behavior?

If those answers live in clear Standard-owned modules, the architecture is strong enough to start building a more powerful agent safely.

## Remaining Open Questions

These are now lower-risk questions, not blockers for Phase 1:

- Should Standard presentation eventually support curated markdown or full markdown?
- Should Standard working summaries ever become server-backed within a session?
- Should the UI visibly label prompt artifacts as separate from the conversational reply?

Those decisions matter, but they can wait until after the response-contract extraction is complete.
