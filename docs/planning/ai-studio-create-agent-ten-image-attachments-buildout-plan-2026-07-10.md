# AI Studio Create Agent Ten-Image Attachments Buildout Plan

Status: remediation complete locally; release and production proof deferred

Purpose: provide the single implementation source for increasing Create-agent image attachments from three to ten without silent truncation, request-size regression, storage-lifecycle expansion, or Standard/Pulse runtime drift.

## Plan Source

- Original source: the audited `Final implementation-ready plan` in Codex goal `019f4c9e-b104-7632-8101-98180e8a0669`.
- Repo source of truth: this document, the current Create Workflow and Pulse contracts, the AI Studio agent/chat/internal-drag SOPs, ADRs 0061 and 0071, and the canonical runtime files named below.
- Current branch authority: local `production`, with `shortpulse.allowedBranch=production`.

## Objective

Allow Standard and Pulse Create composers to accept and actually submit up to ten image attachments in one message while preserving prompt attachments, mode isolation, the chat-only ephemeral lifecycle, current request-body ceilings, and explicit failure behavior. The eleventh image must never silently remove or replace an earlier attachment.

## Owner And Lane

- Create Workflow owns composer intake, attachment state, preview presentation, capacity feedback, and shared attachment-strip UX.
- Pulse owns Standard/Pulse request shaping, server sanitization, thinker/reference context, provider vision preprocessing, and mode-boundary proof.
- Release, commit, push, deployment, and authenticated production validation remain outside this implementation lane.

## Canonical Source Boundaries

- Shared attachment policy and media safety:
  - `frontend/prefabs/agent/`
- Composer intake and local-image preparation:
  - `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`
  - `frontend/features/ai-studio/logic/ephemeralComposerImage.ts`
  - `frontend/features/ai-studio/hooks/agentOrchestration/`
- Mode-owned client runtimes:
  - `frontend/features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts`
  - `frontend/features/ai-studio/createRuntime/usePulseCreateAgentRuntime.ts`
- Client transport:
  - `frontend/features/ai-agent/client/studioAgentTransport.ts`
- Server request authority:
  - `frontend/features/agent-runtime/studioAgentRequestGuards.ts`
  - `frontend/features/agent-runtime/studioAgentRouteEnvelope.ts`
- Thinker and Pulse vision preprocessing:
  - `frontend/features/ai-agent/logic/studioAgentReferenceSelection.ts`
  - `frontend/features/ai-agent/logic/studioAgentOrchestration.ts`
  - `frontend/features/agent-runtime/studioAgentVisionSummaries.ts`
  - `frontend/features/agent-runtime/pulseStudioAgentRuntime/`
- Shared composer presentation:
  - `frontend/features/ai-studio/components/promptStep/`
  - `frontend/styles/prefabs-agent.css`
  - `frontend/styles/ai-studio-create-composer-layout.css`

## Approved Scope

- One shared client/server attachment-count authority.
- Explicit remaining-capacity behavior for sequential and multi-file intake.
- Up to ten image attachments plus preserved prompt-attachment capacity.
- Existing safe HTTPS media URLs where already available.
- Dynamically compacted Base64 transport for true local image files.
- Client request-size preflight under the existing server guard.
- Server rejection instead of product-visible silent truncation.
- Ten-image thinker/reference alignment.
- One batched Pulse vision-summary request instead of one call per image.
- Bounded client preparation concurrency.
- Shared desktop attachment-strip layout, accessibility, copy, and telemetry.
- Focused regression tests and updates to existing agent SOPs.

## Non-Goals

- Durable/project attachment persistence or restore.
- Supabase schema, RLS, buckets, storage cleanup, or Media Library promotion.
- Reference Grid, Quick Slot, Canvas, generation-model reference limits, or the general 25 MB image-upload pipeline.
- Model migration, pricing, credits, billing, mobile-specific work, or visual redesign outside the attachment strip.
- Standard/Pulse route, transcript, session, workflow-state, or artifact-target unification.
- Commit, push, deploy, authenticated production validation, or launch-readiness claims.

## Product And Technical Contract

1. The image cap is ten in Standard and Pulse.
2. Prompt attachments retain their existing independent capacity; increasing image capacity must not reduce prompt-only behavior.
3. Image eleven is rejected with clear capacity feedback. Existing attachments are not evicted.
4. Duplicate references refresh in place without consuming another slot.
5. All visible ready images must survive composer state, client context building, transport serialization, server sanitation, thinker metadata, and provider message construction.
6. Existing trusted HTTPS image URLs remain URLs. True local files remain ephemeral and use compacted inline media; they are not uploaded or persisted for agent vision.
7. The complete mixed request remains below the current 1.5 MiB application guard and 2 MiB parser ceiling.
8. Standard uses one nominal multimodal agent request. Pulse uses one batched vision-summary stage plus one coordinator stage on the nominal successful path. Existing bounded transport retries, malformed-output repair, and Safe Completion recovery may add physical provider calls; every physical call is counted in privacy-safe turn telemetry.
9. Standard/Pulse prompt, transcript, workflow, and hidden-context isolation remain unchanged.

## Implementation Batches

1. Add one shared attachment policy and replace duplicate image, total, media, selected-reference, and thinker literals.
2. Replace silent FIFO eviction with explicit atomic capacity planning; insert accepted placeholders in order and process local files with bounded concurrency.
3. Prefer safe HTTPS sources and add send-time inline-image batch compaction with a 900 KiB client target plus exact serialized-body preflight.
4. Reject over-cap or invalid product media at the server envelope instead of silently slicing it; keep the existing body/parser ceilings.
5. Align selected/thinker image-reference treatment to ten and replace Pulse per-image vision calls with one ID-keyed batched summary request.
6. Share the Standard/Pulse composer attachment strip, use bounded horizontal overflow, improve removal labels/focus/status semantics, and derive copy from the shared policy.
7. Add privacy-safe count/byte/timing/provider-call telemetry without storing prompts, image data, or URLs.
8. Update focused tests and governing SOPs, run local validation, self-audit the final diff, and stop at the release boundary.

## Proof Requirements

Local proof must demonstrate:

- Correct behavior for 0, 1, 3, 10, and 11 images.
- Sequential, one-batch, duplicate, rapid-drop, partial-capacity, and ten-images-plus-prompts behavior.
- Ten mixed HTTPS/local images survive every client and server projection in deterministic order.
- Unsafe or unsupported media fails explicitly; no product request is silently reduced.
- Inline media and the complete serialized request remain inside existing byte ceilings.
- Preparation concurrency is bounded and partial failures are recoverable without corrupting attachment order.
- Standard sends one nominal request with ten images; existing bounded reliability and safety exceptions remain intact.
- Pulse performs one batched summary request and one coordinator request with ten images on the nominal successful path, while retry, repair, and Safe Completion tests prove that additional physical calls are explicit and telemetry-counted.
- Standard/Pulse mode isolation remains intact.
- Desktop overflow, keyboard removal, unique accessible labels, and ready/preparing/failed status work at ten images.
- Targeted tests, touched-file type checks, targeted lint, `npm -C frontend run docs:check`, and `git diff --check` pass, or unrelated pre-existing failures are isolated with evidence.

## Stop Condition

Stop when scoped code, tests, telemetry, and existing SOP updates are locally green and the final audit finds no silent truncation, body-budget regression, provider-call fan-out, mode-boundary drift, persistence expansion, or unresolved in-scope defect.

Stop earlier if overlapping runtime edits cannot be preserved safely, any ready image can disappear before provider construction, the complete request cannot stay below existing limits, Pulse image fan-out exceeds one batched vision-summary call, physical provider calls cannot be accounted for across bounded retry/repair/recovery behavior, validation blocks further safe progress, or required work crosses into persistence, storage, billing, deployment, release, or another owner lane.

This implementation lane stops before commit, push, deploy, authenticated production validation, or production-readiness claims.

## Remaining Production Proof Boundary

Local proof cannot establish real-world fidelity for ten compacted local images, deployed-model latency or token cost, production desktop layout, live control-plane/environment behavior, or authenticated Standard/custom-Pulse/built-in-Pulse behavior. After separately approved commit and deployment, validate 1, 3, 10, and 11 local/internal/mixed image sets at `https://www.shortpulse.ai` with correlated count, byte, latency, and provider-call telemetry.

## Local Completion Evidence

The initial 2026-07-10 local completion claim below was invalidated by a broader second-pass audit. Keep it as historical evidence of what passed, not as current completion authority.

- Shared image capacity is ten; image eleven is explicitly rejected without eviction, duplicates refresh in place, and prompt capacity remains independent.
- Local images use bounded preparation and send-time compaction; safe HTTPS sources remain URLs; client transport measures the serialized request before fetch.
- Server media validation runs before sanitization and rejects over-cap, unsafe, or over-budget media instead of silently reducing it.
- Standard retains one multimodal request; Pulse uses one ID-keyed batched vision-summary request plus one coordinator request.
- Standard and Pulse share the desktop attachment strip and derived capacity copy, with horizontal overflow, status semantics, focus styling, and unique removal labels.
- Privacy-safe payload telemetry records mode, counts, inline bytes, and preparation duration without prompts, image data, or URLs.
- Focused regression result: 15 files passed, 191 tests passed.
- `npm -C frontend run type-check:touched`, targeted ESLint, `npm -C frontend run docs:check`, and `git diff --check` passed.

## Second-Pass Audit Remediation List

This list is the implementation source of truth for reopening the lane. Resolve in order and re-audit after each fix.

1. Reject an eleventh image in a single file batch instead of slicing it before capacity feedback.
2. Preserve attachments added during Standard send preparation or an in-flight request; clear and restore only the outbound snapshot.
3. Preserve partial-capacity and per-file preparation errors when sibling files finish successfully.
4. Mark send-time failed image ids on the restored composer cards so the user can identify and remove them.
5. Prevent stale async duplicate-reference resolutions from overwriting or deleting a newer replacement.
6. Reconcile the Pulse provider-call contract with bounded retry, repair, and Safe Completion recovery without weakening existing safety or reliability behavior.
7. Complete privacy-safe attachment/provider-call telemetry and the missing proof matrix.
8. Remove obsolete SOP guidance that permits silent media omission or describes the current Pulse image path as one physical model call.

Protected contracts for remediation:

- Preserve the current desktop layout, controls, copy style, and Standard/Pulse interaction model except for clearer existing error/status feedback.
- Preserve image-eleven rejection without eviction, duplicate refresh-in-place, independent prompt capacity, ephemeral/no-storage behavior, exact request guards, Standard/Pulse isolation, and current safety/retry/recovery behavior.
- Do not add persistence, storage, billing, security, mobile, compatibility, fallback, alternate-route, or duplicate-authority work.
- Stop before commit, push, deploy, authenticated production validation, launch-posture changes, or any material product-semantics decision that cannot be resolved from the existing contracts.

## Remediation Completion Evidence

Completed locally on 2026-07-10 without commit, push, deploy, storage, persistence, billing, or production mutation.

- One-batch image 11 is rejected while the first ten remain attached; partial-capacity feedback survives successful sibling preparation.
- Standard clears/restores only its outbound attachment snapshot, preserving attachments added during preparation or an in-flight request.
- Preparation failures and send-time failures remain attached to the specific recoverable composer cards in both Standard and Pulse.
- Duplicate structured drops use per-attachment preparation generations, so stale asynchronous completion cannot overwrite, delete, or resurrect newer state.
- Pulse provider accounting now counts every physical vision, coordinator, retry, repair, and Safe Completion recovery call without weakening existing bounded reliability or safety behavior.
- The proof matrix includes 0/1/3/10/11 capacity, one-batch and partial-capacity cases, mixed preparation results, rapid duplicate completion, in-flight Standard intake, failed-card presentation, ten mixed HTTPS/inline transport order, aggregate compaction failure, privacy-safe client telemetry, and an integrated ten-image Pulse vision-plus-coordinator route.
- Consolidated focused result: 17 files passed, 231 tests passed.
- `npm -C frontend run type-check:touched`, targeted ESLint, `npm -C frontend run docs:check`, and `git diff --check` passed.
- Concurrent unrelated worktree changes were preserved and excluded from this lane's completion claim.
