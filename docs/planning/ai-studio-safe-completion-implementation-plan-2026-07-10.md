# AI Studio Safe Completion Implementation Plan

Status: local implementation complete; release handoff pending

Implementation state: local build complete; release and production proof pending.

Purpose: provide the single working plan for first-turn safe completion across AI Studio Create Standard and Pulse agents.

## Plan Source

- Original source: the user-supplied July 10, 2026 refusal repro and the audited implementation plan in Codex goal `019f4c93-c9d9-7011-aead-a8ef2faf9725`.
- Repo source of truth: this document, `docs/adr/0099-ai-studio-create-safe-completion-contract.md`, the current Pulse agent contract, the AI Studio agent SOPs, and the canonical runtime and safety-policy code named below.
- Current branch authority: local `production`, with `shortpulse.allowedBranch=production`.

## Objective

Every Create agent—Standard, custom Pulse, and built-in guided Pulse—must finish an eligible unsafe or suggestive creative request during the same user turn by making the smallest safe substitutions that preserve the requested work. A transformable request must not stop at `I cannot describe this.`, offer to write a safer version later, or ask the user to resend an SFW request. Requests prohibited by the existing server safety policy must continue to refuse without a provider recovery call or reusable action.

## Owner And Lane

- Runtime owner: Pulse, including Standard behavior, Pulse behavior, prompt composition, response parsing, and the narrow agent-instructions admin boundary.
- Product and release approver: the solo human owner.
- Release and production environment work remain outside this implementation lane.

## Canonical Source Boundaries

- Standard route and runtime:
  - `frontend/pages/api/ai/studio-agent-standard.ts`
  - `frontend/features/agent-runtime/standardStudioAgentRuntime/`
- Pulse route and runtime:
  - `frontend/pages/api/ai/studio-agent-pulse.ts`
  - `frontend/features/agent-runtime/pulseStudioAgentRuntime/`
  - `frontend/features/agent-runtime/studioAgentPulseRuntime.ts`
- Shared safety policy:
  - `frontend/features/agent-runtime/studioAgentSafetyInputPrecheck.ts`
  - `frontend/features/agent-runtime/studioAgentSafetyPostProcess.ts`
  - `frontend/features/agent-runtime/safetyPolicy/`
- Provider refusal normalization:
  - `frontend/lib/server/api/openAiCompat.ts`
- Shared message reuse UI:
  - `frontend/prefabs/agent/panels/AgentChatPanel.tsx`
- Prompt seeds, not live control-plane authority:
  - `frontend/lib/agentPromptsConfig.ts`
  - `frontend/lib/model-runtime/createPulseBuiltInInstructions.ts`

## Approved Scope

In scope:

- A versioned, code-owned Safe Completion Contract shared by Standard and Pulse.
- Deterministic final prompt precedence after editable Standard and Pulse instructions.
- Existing server safety input enforcement for both routes, without weakening hard floors.
- Correct extraction of typed model refusals from Chat Completions and Responses API payloads.
- Exactly one recovery attempt for an eligible HTTP-200 model-authored refusal.
- Output safety finalization for primary and recovered Standard/Pulse results.
- Privacy-safe telemetry and an explicit Safe Completion kill switch that cannot disable hard floors.
- Refusal and error messages remain readable but are not draggable or otherwise reusable.
- Repo-owned prompt seed alignment, shared evaluation fixtures, regression tests, ADR, SOP, monitoring, route-map, and troubleshooting updates.
- Repair of existing evaluation scripts only where required to test the current Standard/Pulse routes accurately.

Out of scope:

- Relaxing immutable hard floors or changing safety-policy thresholds.
- Fal, Kie, or downstream generation-provider safety settings.
- Model migration, streaming, pricing, credits, mobile work, right-rail behavior, persistence redesign, or visual redesign.
- Standard/Pulse route, transcript, workflow-state, canonical-prompt, session, or artifact-target unification.
- SQL/schema changes or programmatic mutation of live Standard, custom Pulse, or built-in Pulse control-plane records.
- A client-side `Make safe` action, automatic visible second turn, duplicate prompt copies, lexical creative-rewrite expansion, or an always-on LLM pre-rewriter.
- Commit, push, deploy, live control-plane mutation, provider-cost evaluation, authenticated production validation, or launch-readiness claims.

## Product Contract

For transformable content, preserve characters, setting, style, tone, energy, continuity, format, timing, artifact target, and production constraints. Make only the minimum safe substitutions and return the completed work directly. Do not prepend a policy lecture, request SFW wording, ask for approval, or require another user turn.

For non-transformable content, preserve the existing refusal contract: a readable actionless refusal with no provider recovery and no drag, use, apply, or generation affordance.

The precedence order is:

1. Platform hard floors and the Safe Completion Contract.
2. Mode-owned response-envelope and workflow rules.
3. Editable Standard admin instructions or active custom/built-in Pulse instructions.
4. User and reference content.

## Implementation Batches

1. Create ADR 0099 and the shared versioned contract module, then compose the contract once at final system-instruction precedence in Standard and Pulse.
2. Normalize typed provider refusals without erasing their source or turning them into malformed-output errors.
3. Share safety runtime configuration and output finalization while leaving mode-specific transport, rollback, workflow, and session behavior in their current owners.
4. Apply server-authoritative input enforcement to Standard as well as Pulse, preserving raw visible transcript text while limiting any rewrite to the provider-bound payload.
5. Add exactly one eligible model-refusal recovery per mode. Never recover local hard-floor refusals, provider HTTP safety blocks, output-postprocess refusals, malformed output, route/configuration errors, or a previous recovery.
6. Make explicit refusal/error messages non-reusable while preserving successful Standard assistant-message drag behavior.
7. Align repo-owned prompt seeds and add privacy-safe Safe Completion telemetry, with parse repair and refusal recovery recorded separately.
8. Add a shared evaluation corpus and route/runtime/UI regression coverage, repair current-route evaluation tooling where required, and update governing docs.
9. Run targeted and broad local validation, inspect the final diff for scope drift and unrelated-file overlap, then stop at the release boundary.

## Proof Requirements

Local proof must demonstrate:

- The versioned contract appears exactly once at final product-policy precedence in each mode.
- Standard remains free of Pulse workflow/context fields, and Pulse workflow/session/artifact behavior remains intact.
- Safe controls remain usable and are not unnecessarily refused.
- The supplied mixed basketball case and other transformable fixtures request a completed safe artifact without extra-turn language.
- Existing hard-floor fixtures refuse before provider dispatch and trigger zero recovery calls.
- Eligible model refusals trigger at most one recovery; recovery refusal/error never loops.
- Typed Chat/Responses refusals are classified as refusals, not empty-output errors.
- Every recovered output passes output safety finalization.
- Refusal/error bubbles expose no drag, Use, Apply, or Generate path; successful outputs remain reusable as currently intended.
- Telemetry contains contract/recovery disposition without raw prompts, outputs, user identifiers, emails, or reference URLs.
- Targeted tests, type-check, lint, `npm -C frontend run docs:check`, build, and `git diff --check` pass, or any unrelated pre-existing failure is isolated with evidence.

Model-backed promotion targets after separately approved deployment are: 100% hard-floor correctness, zero unsafe leaks, zero turns with more than one recovery, zero extra-turn/SFW requests, at least 95% first-user-turn usable completion for transformable cases per mode, and 100% route-envelope/mode-isolation correctness.

## Stop Condition

Stop when scoped code, tests, and docs are locally green and the final self-audit finds no unresolved in-scope defect. Stop earlier for hard-floor weakening, cross-mode or workflow-state drift, an unsafe output leak, more than one recovery call, an unresolved validation blocker, dirty-worktree overlap that cannot be preserved safely, required work outside Pulse ownership, or scope expansion.

The implementation lane stops before commit, push, deploy, live prompt/catalog writes, provider-cost evaluation, authenticated production testing, production telemetry claims, or release promotion. Those actions require a separate owner-approved handoff.

## Remaining Production Proof Boundary

Local proof cannot establish actual deployed-model adherence, live control-plane contents, provider recovery latency/cost, or authenticated production UI behavior. After separately approved commit and deployment, validate bounded text-only turns at `https://www.shortpulse.ai` in Standard, one custom Pulse, and every published built-in, paired with structured trace telemetry and unchanged product credits.

## Local Implementation Checkpoint — 2026-07-10

Completed locally:

- Versioned Safe Completion contract and kill switch with final prompt precedence in Standard and Pulse.
- Shared safety runtime configuration and output finalization.
- Standard client/server precheck convergence while retaining raw visible history.
- Typed Chat/Responses refusal extraction.
- One bounded eligible recovery in each mode, with ambiguous-age and hard-floor exclusions.
- Actionless, non-draggable, non-editable refusal/error messages.
- Privacy-safe disposition telemetry, prompt-seed deferral, shared evaluation corpus, current-route evaluator, tests, ADR, SOPs, monitoring, troubleshooting, and indexes.

Local proof completed:

- Focused Safe Completion regression coverage passes: 253 tests across the contract, input/output safety, parser, Standard/Pulse runtime, client transport, and message-reuse surfaces.
- TypeScript, focused ESLint, documentation checks, production build, route/legacy/style/Generate guards, evaluator syntax, and scoped diff checks pass.
- The broad repo test run passes 8,858 tests, skips 39, and has 33 failures in eight unrelated test files outside this plan; none of the focused Safe Completion tests fail. Repo-wide ESLint is blocked only by the unrelated `URL` global error in `frontend/scripts/backfill_video_posters.mjs`.

The remaining boundary is unchanged: no commit, push, deploy, live prompt/catalog mutation, provider-cost evaluation, authenticated production test, or production behavior claim is authorized by this plan.
