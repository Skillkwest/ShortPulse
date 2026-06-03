# Standard Mode Assistant Parity Plan V1

Date: 2026-06-02
Owner: Pulse
Scope: AI Studio Create Standard-mode agent only
Mode: planning only, no product-code behavior changes in this document

## Purpose

Define the best repo-compatible plan for turning Standard mode into a robust general assistant that behaves as intelligently and helpfully as possible within ShortPulse, while preserving the Standard/Pulse boundary, avoiding major UI churn, and keeping implementation disciplined.

This plan deliberately treats Standard as `Standard v2`, a true assistant-runtime program, not a prompt-writing polish track.

## User Goal

The target is a Standard-mode agent that feels much closer to ChatGPT in the ways users actually experience:

- direct, adaptive, high-judgment conversational help
- useful session memory
- strong image understanding
- file reading and grounded response behavior
- better clarification discipline
- better refusal accuracy
- less prompt-specialist bias when the user simply wants help

The user wants this plan to include a deliberate research and verification lane for choosing the best Standard default model instead of assuming `GPT-5.5` automatically.

## Core Recommendation

Build this in the existing Standard lane as a phased backend/runtime modernization program.

Do not begin with UI redesign, broad prompt-library rewrites, or speculative third-party memory products.

Recommended strategy:

1. research and upgrade Standard's default model policy
2. shift Standard from pass-through chat-completions behavior toward a real assistant runtime
3. add stronger conversation state and session memory
4. add file-input support
5. harden behavior quality with evals

## Chosen Approach

The chosen implementation approach is:

- preserve the current Standard/Pulse isolation contract
- preserve the current Create panel host surface as much as possible
- modernize the Standard backend and Standard behavior contract in place
- keep prompt artifacts optional and secondary
- make conversational assistance the primary identity of Standard

This is intentionally not a multi-agent build, not a big UI rewrite, and not a parallel Standard implementation.

## Source Of Truth

Implementation and proof for this plan should anchor to these current seams:

- `frontend/pages/api/ai/studio-agent-standard.ts`
- `frontend/features/agent-runtime/standardStudioAgentRuntime/runtime.ts`
- `frontend/features/agent-runtime/studioAgentOpenAiGateway.ts`
- `frontend/features/ai-agent/useCreateAgentStateCore.ts`
- `frontend/features/ai-agent/client/standardResponseContract.ts`
- `frontend/features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts`
- `frontend/features/ai-studio/hooks/agentOrchestration/runStandardCreateAgentSend.ts`
- `frontend/features/ai-studio/createRuntime/standardMemory/`
- `frontend/features/ai-studio/components/promptStep/standardPresentation/`
- `frontend/lib/model-runtime/modelCatalog.ts`

Boundary and governance authorities:

- `docs/adr/0061-ai-studio-standard-vs-pulse-runtime-isolation-contract.md`
- `docs/adr/0070-project-workspace-conversational-runtime-exclusion.md`
- `docs/adr/0071-ai-studio-create-mode-owned-runtime-roots.md`
- `docs/adr/0083-create-mode-global-right-rail-authority.md`
- `docs/sops/sop_ai_studio_agent.md`
- `docs/sops/sop_ai_studio_pulse_mode.md`
- `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`

## Constraints

This plan assumes the current user constraints remain active:

- no major UI redesign as part of early phases
- do not create a mess
- preserve Standard/Pulse isolation
- prefer high-ROI changes
- avoid duplicate runtime paths, hidden fallbacks, or speculative infrastructure

## Zero-Drift Rules

Unless the user explicitly rewrites these later:

- no Pulse runtime changes
- no Standard/Pulse transcript mixing
- no hidden Pulse-context leakage into Standard
- no major Create-panel workflow redesign in early phases
- no right-rail ownership change
- no broad persistence or database redesign in early phases
- no third-party memory product for `v1`
- no assistant-to-composer silent prompt replacement
- no route explosion unless a later proof gate explicitly requires it

## Product Contract Direction

Standard v2 should become:

- a conversation-first assistant
- still able to emit prompt artifacts when useful
- still able to support generation workflows
- but no longer primarily shaped like a prompt-refinement lane

That means the primary success metric is better general assistance behavior, not just better prompt output.

## Current-State Audit Summary

The current repo-backed Standard stack is materially stronger than before, but it is still not a true ChatGPT-like assistant runtime.

Current Standard shape:

- Standard route isolation already exists at `frontend/pages/api/ai/studio-agent-standard.ts`
- Standard server execution is still a one-turn OpenAI Chat Completions pass-through in `frontend/features/agent-runtime/standardStudioAgentRuntime/runtime.ts`
- Standard runtime config still resolves through `frontend/features/agent-runtime/studioAgentOpenAiGateway.ts`
- Standard memory is still session-scoped and synthetic, built from transcript-window plus derived working state in `frontend/features/ai-studio/createRuntime/standardMemory/`
- Standard still returns through a prompt-capable response contract in `frontend/features/ai-agent/client/standardResponseContract.ts`
- Standard already supports image-grounded turns in a partial form, but not general file-reading as a first-class assistant capability

This means the repo does not need a from-scratch rebuild, but it does need a runtime and capability modernization program.

## Realistic Parity Target

This plan aims for `ChatGPT-like` Standard behavior, not a literal product clone.

For this plan, `ChatGPT-like` means:

- direct and adaptive conversational help
- strong image understanding
- grounded file-question answering for supported file types
- useful per-session memory
- good clarification judgment
- strong critique, rewrite, summarize, and explain behavior
- better refusal accuracy
- better formatting and verbosity judgment

It does not mean that Standard v1 of this plan must immediately include every ChatGPT-adjacent capability.

## Explicit Non-Goals For This Plan

Unless later explicitly approved, this plan does not require:

- web browsing as part of default Standard turns
- computer use
- code interpreter
- multi-agent orchestration
- voice agent behavior
- cross-project or long-term durable personal memory
- a major Create-panel redesign

Those may become valid follow-on lanes later, but they are not required to make Standard substantially more like a robust general assistant.

## Phase Plan

### Phase 0. Proof Surface Lock

Goal:
Pin the proof surface for Standard runtime, Standard memory, Standard presentation, Standard route behavior, and Standard/Pulse boundary behavior before broader assistant work begins.

In scope:

- lock the current Standard route/runtime tests
- lock the current Standard memory tests
- lock the current Standard presentation tests
- add narrowly missing evals where the next phases would otherwise be under-proven

Out of scope:

- behavior expansion
- model changes
- file support

Proof gate:

- named Standard proof surface exists
- current Standard/Pulse isolation remains covered
- current Create-panel ownership and route compatibility remain covered
- the current Standard baseline is traceable enough that later behavior regressions can be compared against concrete evidence instead of memory alone

Recommended addition:

- where useful, add trace-oriented or runtime-behavior eval hooks early so later assistant-runtime work can be debugged with workflow evidence instead of output-only snapshots

Checkpoint note from 2026-06-02 implementation:

- locked Phase 0 proof command:
  - `npm -C frontend run test -- lib/model-runtime/__tests__/modelCatalogDefaultRoles.test.ts features/agent-runtime/__tests__/studioAgentOpenAiGateway.test.ts tests/api/studio-agent.runtime.test.ts tests/api/studio-agent.standard-evals.test.ts features/agent-runtime/__tests__/studioAgentResponseNormalization.test.ts features/ai-studio/components/promptStep/standardPresentation/__tests__/standardMessageRenderer.test.tsx features/ai-studio/createRuntime/__tests__/useStandardCreateAgentRuntime.test.ts features/ai-agent/__tests__/createAgentBoundary.test.ts`
- current result at this checkpoint:
  - `8` test files passed
  - `89` tests passed
- this command is now the preferred Phase 0 proof gate before and after Standard model-policy work unless a later plan revision explicitly changes the proof surface

### Phase 1. Standard Model Research And Default Model Upgrade

Goal:
Research, choose, and then upgrade Standard's default main chat model from `gpt-5.4-nano` to the best verified model for a ChatGPT-like Standard assistant.

Why first:

- if the product goal is ChatGPT-like Standard behavior, the current default model is too weak to be the long-term assistant brain
- behavior evals after this phase become much more meaningful
- OpenAI model availability and best-model guidance are current-state questions that should be verified before committing to a specific identifier

Implementation targets:

- research current official OpenAI model guidance and current available GPT-family candidates for a ChatGPT-like assistant target
- compare candidate models against Standard-mode needs:
  - conversational intelligence
  - multimodal/image understanding
  - tool compatibility for later Standard v2 phases
  - latency
  - cost
  - likely production availability
- choose one verified default-model candidate and record why it won
- update Standard default chat model authority in `frontend/lib/model-runtime/modelCatalog.ts`
- update any Standard model-role tests that assume `gpt-5.4-nano`
- verify Standard runtime continues to resolve the correct default model through `studioAgentOpenAiGateway.ts`

Constraints:

- change Standard chat default first
- do not silently widen this into a whole-model-catalog cleanup
- vision default may remain separate unless explicitly proven necessary in the same slice
- do not assume `gpt-5.5` unless it is verified as both available and the best fit for this use case

Research gate:

- verify the current official OpenAI model lineup and model-selection guidance
- verify whether `gpt-5.5` is actually available in the production OpenAI org
- if `gpt-5.5` is not verified or is not the best fit, choose the strongest verified alternative and update the plan implementation accordingly

Recommended evaluation criteria:

- best conversational quality for a general-purpose assistant
- strong image input performance
- compatibility with Responses-based assistant-runtime migration
- acceptable latency for Create-panel chat
- acceptable cost for Standard as the default assistant lane
- suitability for either a fixed snapshot policy or a moving alias policy

Required decision artifact:

- produce a short model decision packet before the default-model switch is finalized
- the packet should name each serious candidate and compare:
  - model type: fixed snapshot versus moving alias
  - conversational quality
  - image capability
  - latency
  - cost
  - production availability
  - final recommendation and why it won

Recommended candidate classes:

- fixed flagship GPT-family reasoning/chat candidates
- ChatGPT-oriented chat aliases if officially available for API use
- one cost-optimized smaller candidate for baseline comparison

Chat versus vision policy:

- do not assume the best Standard chat model is also the best Standard vision model
- keep chat and vision model selection explicitly separable
- if the same model wins both lanes, record that as a verified decision rather than an assumption

Production verification gate:

- before finalizing the chosen default model, verify the selected model is actually available in the production OpenAI org
- repo catalog presence or public docs presence alone is not enough

Checkpoint note from 2026-06-02 implementation:

- if the current execution environment cannot verify production OpenAI org availability directly, Phase 1 may still produce the required model decision packet
- in that case, stop before changing repo default-model authority and treat live org verification as the blocking gate for the code switch

Model policy decision:

- explicitly choose whether Standard should default to a moving alias or a fixed model identifier
- if using a moving alias, define when and how Standard re-verifies behavior after upstream model changes
- if using a fixed model identifier, define the review cadence for reconsidering upgrades

Rollback rule:

- if the chosen default model causes unacceptable latency, cost, refusal behavior, or regression on the Standard proof surface, revert to the prior default model
- keep the model decision packet and failed evaluation evidence so the next model trial starts from concrete data instead of opinion

Proof gate:

- a model-selection note exists naming the evaluated candidates, the chosen model, and the reasons it won
- repo default role for `studio-agent-chat` resolves to the chosen verified model
- Standard route/runtime tests pass
- no Pulse default-model drift is introduced by accident

Stop condition:

- Standard main chat default is switched to the chosen verified model and proven in repo tests

Checkpoint note from 2026-06-02 implementation:

- production verification is complete:
  - production previously pinned `OPENAI_MODEL=gpt-5.4` and `OPENAI_VISION_MODEL=gpt-5.4`
  - the production OpenAI key accepted `gpt-5.5` as a valid model slug
- implemented in this phase:
  - repo default roles for `ai-studio-text-prompt`, `studio-agent-chat`, and `studio-agent-vision` now resolve to `gpt-5.5`
  - local env pins now use `gpt-5.5` for `OPENAI_MODEL` and `OPENAI_VISION_MODEL`
  - Vercel production `OPENAI_MODEL` and `OPENAI_VISION_MODEL` were updated to `gpt-5.5`
  - `STUDIO_AGENT_PULSE_MODEL` remains pinned separately so Pulse does not move as part of this Standard phase
- proof at this checkpoint:
  - locked Phase 0 proof command passed again with `8` test files and `89` tests

### Phase 2. Standard Runtime Primitive Upgrade

Goal:
Move Standard toward a true assistant runtime instead of a raw one-turn chat-completions pass-through.

Chosen direction:

- modernize Standard runtime behavior at the server-owned seam
- preserve the existing route boundary and panel contract where possible
- prefer in-place runtime replacement or an internal feature-flagged migration path instead of a long-lived parallel public runtime

Current-state delta this phase must close:

- Standard still uses Chat Completions instead of Responses
- Standard still manages turn continuity mostly outside the server runtime
- Standard still behaves like a one-turn assistant wrapper rather than a true assistant-runtime primitive

Realistic implementation dependency:

- `frontend/features/agent-runtime/studioAgentOpenAiGateway.ts` is currently Chat Completions-specific
- this phase must either replace or extend the gateway for Responses-style execution instead of pretending the migration is only a runtime-prompt change

Implementation targets:

- introduce a Standard v2 runtime execution path inside the current Standard-owned runtime folder
- prefer OpenAI Responses-style assistant execution over plain chat-completions behavior
- preserve Standard/Pulse route isolation
- keep migration behind the current Standard route rather than creating a public parallel route unless unavoidable

Migration boundary:

- if a temporary internal feature flag is needed, use it only as a bounded migration aid inside the current Standard route
- do not create a second public Standard route or a durable shadow runtime unless a later proof gate explicitly requires it
- if the migration starts demanding broad route-surface duplication, stop and replan instead of widening Phase 2 by momentum

In scope:

- runtime execution primitive
- server-side conversation semantics
- response/result shaping updates needed for the new execution model

Out of scope:

- UI redesign
- Pulse migration
- broad admin changes

Proof gate:

- Standard runtime still satisfies the current route boundary contract
- Standard success, refusal, and upstream-error paths remain covered
- no new cross-mode leakage is introduced
- the Standard runtime can carry forward conversation state using the chosen Responses-style mechanism instead of relying only on manual transcript replay
- the OpenAI gateway path used by Standard is compatible with the chosen Responses-style assistant execution model

Checkpoint note from 2026-06-02 implementation:

- completed bounded Phase 2 transport slice:
  - `frontend/features/agent-runtime/studioAgentOpenAiGateway.ts` now exposes Standard-owned transport flags:
    - `STUDIO_AGENT_STANDARD_RESPONSES_ENABLED`
    - `STUDIO_AGENT_STANDARD_CHAT_FALLBACK_ENABLED`
  - `frontend/features/agent-runtime/standardStudioAgentRuntime/runtime.ts` now passes those flags into the shared OpenAI compatibility layer as a Standard-scoped env override
  - the current Standard route can execute through `/v1/responses` without widening into a second public Standard route or moving Pulse/global helper callers at the same time
- proof at this checkpoint:
  - targeted gateway, Standard route, and OpenAI compatibility tests passed with `46` tests across:
    - `features/agent-runtime/__tests__/studioAgentOpenAiGateway.test.ts`
    - `tests/api/studio-agent.runtime.test.ts`
    - `lib/server/api/__tests__/openAiCompat.test.ts`
  - `npm -C frontend run docs:check` passed
- remaining Phase 2 gap:
  - this checkpoint proves the Standard-owned transport migration seam and route-boundary preservation
  - it does not yet satisfy the full Phase 2 proof gate because Standard conversation state still depends primarily on manual transcript replay rather than a chosen Responses-style state mechanism

### Phase 3. Conversation State And Memory V2

Goal:
Make Standard conversation continuity feel much more like a real assistant and less like transcript replay plus recap text.

Chosen direction:

- preserve session-scoped memory for the initial version
- keep Standard memory explicitly owned in the Standard lane
- evolve from synthetic recap toward richer stateful conversation handling

Current-state delta this phase must close:

- Standard memory is currently a synthetic assistant memory message, not a first-class server-side assistant state model
- Standard continuity is still biased toward local/session replay and derived recap text

Implementation targets:

- strengthen session memory from transcript window plus summary into a more durable assistant state model
- improve working-state fields and retrieval policy
- decide what state is client-owned versus server-owned
- keep compatibility with current restore boundaries unless an explicit later replan changes that contract

In scope:

- richer session memory
- stronger task/constraint/decision continuity
- memory compaction for longer chats

Out of scope:

- long-term cross-project memory
- broad project-workspace persistence redesign

Proof gate:

- Standard retains goals and constraints better over longer sessions
- longer sessions do not degrade into transcript noise replay
- snapshot compatibility remains intact unless a later approved migration changes it
- context compaction or equivalent state reduction exists so longer conversations stay coherent without uncontrolled token growth

### Phase 4. File And Multimodal Understanding

Goal:
Enable Standard to read attached files and respond to them as a real assistant, not just handle images and prompt references.

Chosen direction:

- add file-reading capability in the Standard lane
- start with the most valuable and supportable file classes first

Current-state delta this phase must close:

- Standard already handles image-grounded context in a limited way
- Standard does not yet behave like a real file-reading assistant for attached documents

Realistic implementation dependency:

- this phase likely requires a Standard-owned file-ingestion and file-identity policy, not just richer attachment text in the prompt
- supported files may need different handling paths:
  - direct multimodal input
  - extracted text
  - retrieval-backed search over attached content

Recommended first file set:

- images
- PDFs
- text-like attachments where safe and practical

Recommended defer list:

- spreadsheets requiring deep structured analysis
- slide-deck-native reasoning beyond text extraction
- arbitrary binary formats
- anything that would require a broad storage or ingestion platform redesign in the first pass

Implementation targets:

- extend Standard attachment/context preparation
- define the ingestion path for each first-pass supported file type
- define Standard file-input policy and supported file types
- ensure Standard can answer grounded questions about uploaded content

Constraints:

- keep Pulse boundaries intact
- keep unsafe or unsupported file handling fail-closed
- do not turn this into a generic storage/platform refactor

Proof gate:

- Standard can answer grounded file questions for supported file types
- image-question and file-question behaviors remain differentiated and coherent
- unsupported file types fail clearly without ambiguous assistant behavior

### Phase 5. Standard Response Contract Shift

Goal:
Make Standard's product identity conversation-first rather than prompt-first.

Chosen direction:

- keep prompt artifacts available
- stop treating them as the conceptual center of the Standard lane

Implementation targets:

- evolve the Standard response contract so conversational reply becomes the primary contract
- keep optional prompt artifacts explicit and secondary
- reduce implicit pressure toward `success_prompt` semantics when the user is simply asking for help

Proof gate:

- conversational answers no longer feel artificially bent toward prompt production
- generation workflows that depend on prompt artifacts still work where intended

### Phase 6. Assistant Behavior Quality And Eval Program

Goal:
Systematically improve Standard's behavior quality toward ChatGPT-like usefulness.

Target behavior categories:

- direct answering
- clarification judgment
- verbosity control
- critique and evaluation quality
- image Q and A quality
- file understanding
- memory retention
- refusal accuracy
- formatting judgment

Implementation targets:

- expand Standard eval cases
- define pass/fail heuristics for the key assistant behaviors
- use evals to drive runtime and instruction improvements

Recommended eval order:

- start with traces and concrete workflow failures while the runtime is still changing quickly
- then formalize the most important scenarios into named repeatable eval datasets and graders

Recommended early assistant eval categories:

- general chat helpfulness
- image-question grounding
- file-question grounding
- memory retention over short and medium sessions
- refusal accuracy on benign versus truly blocked asks
- verbosity and formatting judgment

Proof gate:

- Standard has a named assistant-quality eval surface
- improvements are measured against that surface instead of ad hoc taste alone

## What This Plan Deliberately Does Not Start With

This plan intentionally does not begin with:

- broad UI redesign
- prompt-library beautification
- third-party memory tools
- multi-agent orchestration
- speculative database migrations
- Pulse-mode convergence work

Those may become valid later, but they are not the chosen highest-ROI path now.

## Recommended First Implementation Slice

Start with `Phase 0 + Phase 1`.

Reason:

- it is small
- it is high ROI
- it aligns the Standard default brain with the stated product target using research rather than assumption
- it avoids premature backend migration before the proof surface is locked

First slice files:

- `frontend/lib/model-runtime/modelCatalog.ts`
- model default-role tests under `frontend/lib/model-runtime/__tests__/`
- Standard route/runtime tests already covering model resolution and route behavior

Immediate follow-up slice after Phase 1:

- a narrow Standard runtime spike that proves the Responses-style migration path can preserve the current route boundary before broader memory or file work begins
- that spike should also prove the chosen model policy works with the intended runtime primitive, especially if the winning candidate is a moving chat alias rather than a fixed snapshot

## Checkpoint Reporting Protocol

At every meaningful checkpoint during implementation, report all of the following explicitly:

1. whether the overall plan is complete or not
2. an audit of the step or phase that just completed
3. the decision about what to do next
4. the written next action based on that decision

Checkpoint audit expectations:

- say whether the just-completed step stayed in scope
- name any drift, gaps, or follow-up risk discovered in that step
- say whether the proof gate for that step was actually satisfied

Checkpoint decision rule:

- if the overall plan is complete, stop
- if the current proof gate is not satisfied, fix that before moving on
- if the current proof gate is satisfied and the next phase is already approved by this plan, state the next phase and continue only within that approved scope
- if the next work would widen scope beyond this plan, stop and replan instead of continuing by momentum

## Stop Condition For This Plan

This plan is complete when:

- the named phases are either implemented or explicitly superseded by a newer approved Standard v2 plan
- Standard has a stronger researched-and-verified default model
- Standard runtime is moved toward a real assistant execution model
- Standard has richer session memory
- Standard can handle supported files and images more like a real assistant
- Standard evals cover the main assistant-quality behaviors

Do not continue beyond these phases by momentum alone. Any work after that should start as a new plan or a concrete follow-up bug/capability lane.

## Recommended Next Action

Begin `Phase 0 + Phase 1` first.

That is the cleanest next move because it creates a stronger baseline for every later assistant-quality and runtime-modernization phase without widening scope too early.
