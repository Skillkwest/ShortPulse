# Gutan Training History

Purpose: chronological record of supervised Gutan runs, learned behavior, SOP/tool changes, remaining friction, and next training focus.

## 2026-05-30 - Agent Setup And First-Job Scaffold

Prompt used:

```text
Go ahead and create your own folder in this repo. This will be your space that you own. Create your memories, create your artifacts, create your agent instructions, and create any tools you may think you need for your first job of building our product image compression system.
```

Behavior learned:

- Gutan is a bounded image-ingestion normalization steward.
- Gutan's first job is product image admission for <=25 MB processing/generation surfaces while preserving full-quality originals for save/export.
- Gutan must coordinate with Holomony and Nuclo without taking over display optimization or storage architecture.

SOP or template updates:

- Created Gutan contract, local instructions, SOP, ownership manifest, memory, artifact README, initial surface inventory, and tool inventory.

Tool changes:

- Created `scripts/ops/gutan/gutan_image_admission_inventory.sh` as a lightweight surface inventory helper.

Remaining friction:

- Animated over-cap image behavior still needs a product decision.
- Generated-image admitted derivative timing still needs a product decision.
- Implementation has not started.

Next training focus:

- Use the SOP to produce an implementation-ready build map for the image admission system, then implement only after the user approves the build lane.

## 2026-05-30 - Image Admission Policy Decisions

Prompt used:

```text
Expand on these as you see fit and establish them as you need. You have full ownership and authority to make decisions. You need to decide what we do and how we do it, making sure that it is done correctly for this repo, for this app, and for this product.
```

Behavior learned:

- Gutan should make product-use image-admission decisions directly while preserving adjacent owner boundaries.
- Gutan can establish high-ROI policy artifacts before implementation when decisions would otherwise remain trapped in chat.

SOP or template updates:

- Added `image-admission-policy.md` as the accepted first-build policy artifact.
- Updated Gutan load instructions, memory, artifact README, and tool inventory to reference the policy.

Tool changes:

- No new tools.

Remaining friction:

- Schema changes for first-class admitted variants require Nuclo/Dave validation during implementation.

Next training focus:

- Convert the accepted policy into an implementation plan with exact code paths, route migrations, tests, and handoffs.

## 2026-05-30 - Image Admission Implementation Plan

Prompt used:

```text
Go ahead and create a plan.
```

Behavior learned:

- Gutan should preserve the line between planning and implementation when the user asks for a plan.
- A high-ROI implementation plan should be an artifact with exact phases, code paths, validation, and owner handoffs rather than a chat-only outline.

SOP or template updates:

- Added `image-admission-implementation-plan.md`.
- Updated the artifact README and tool inventory to include the implementation plan.

Tool changes:

- No new tools.

Remaining friction:

- The `admitted_reference_25mb` variant kind still requires Nuclo/Dave schema/security validation if implemented as the preferred first-class variant row.

Next training focus:

- Begin implementation at Phase 0 only after the user explicitly asks to build.

## 2026-05-30 - Phase 0/1 Implementation Start

Prompt used:

```text
Begin implementation of the plan.
```

Behavior learned:

- Gutan should begin with the canonical admission core and durable upload path before migrating Character, Elements, remote import, generated reuse, or ephemeral provider-submit surfaces.
- Behavior preservation includes keeping under-cap image outer dimension metadata on the pre-existing lightweight parser path, even when nested admission metadata can record richer server-derived dimensions.

SOP or template updates:

- Updated Gutan memory to replace stale open questions with resolved first-build decisions.

Tool changes:

- No new tools.

Remaining friction:

- Character Manager and Elements Manager still need the planned allowlisted route adapter before removing direct client storage uploads.
- Generated-image reuse and ephemeral provider-submit admission remain unimplemented follow-up phases.

Next training focus:

- Design Phase 0.5 allowlisted route adapters without broadening Gutan into storage architecture, display optimization, or UI behavior changes.

## 2026-05-30 - Phase 0.5 Allowlisted Route Adapter

Prompt used:

```text
Continue with your suggested next steps.
```

Behavior learned:

- Gutan should create the server-owned admission seam before migrating Character or Elements clients.
- The adapter must accept a bounded product intent and target ids, never a client-provided bucket or storage path.
- Ownership checks belong before storage writes so rejected Character/Element targets do not leave orphaned media.

SOP or template updates:

- Updated the Gutan SOP with route-adapter requirements.
- Updated route/API documentation for `/api/media/admit-image-asset`.
- Updated Gutan memory, surface inventory, and implementation plan status.

Tool changes:

- No new tools.

Remaining friction:

- Character Manager profile, sheet preset, and slot saves still need to call `/api/media/admit-image-asset` instead of direct client storage uploads.
- Elements Manager profile image saves still need to call `/api/media/admit-image-asset`.

Next training focus:

- Migrate Character Manager persistence to the new route while preserving existing preview, metadata, save/reopen, and cleanup behavior.

## 2026-05-30 - Character And Elements Client Migration

Prompt used:

```text
Continue with your suggested next steps.
```

Behavior learned:

- Gutan should remove direct client upload bypasses only after the server-owned route has proven intent allowlisting, ownership checks, and canonical admission.
- Cleanup deletes may remain client-side when they only remove a server-created, user-scoped object after a downstream metadata save/update fails.
- Storage path construction for Character/Elements product image assets should stay server-owned; leaving unused client path builders behind creates avoidable drift risk.

SOP or template updates:

- Updated Gutan memory, surface inventory, and implementation plan status to reflect Character Manager and Elements Manager migration progress.

Tool changes:

- No new tools.

Remaining friction:

- Remote URL import admission, generated-image reuse admission, and ephemeral provider-submit admission remain open phases.
- Variant-row support for generated-image admitted derivatives still requires Nuclo/Dave schema/security validation if implemented as first-class `media_asset_variants`.

Next training focus:

- Move to remote URL import admission only after the current Character/Elements checkpoint passes focused validation and self-audit.

## 2026-05-30 - Remote URL Import Admission

Prompt used:

```text
Continue with your suggested next steps.
```

Behavior learned:

- Remote copy admission must distinguish the route transport cap from the final 25 MB product-use image cap, otherwise over-cap trusted still images fail before the canonical admission helper can run.
- The safe remote-copy change is server-only: fetch trusted still images under the broader transport cap, admit them through `admitImageBufferForProductUse`, store the admitted object, and leave video/audio copy behavior unchanged.
- Tests for large remote imports should avoid allocating huge in-memory buffers when a `Content-Length` header can prove the transport/admission boundary.

SOP or template updates:

- Updated Gutan memory, surface inventory, implementation plan status, README route summary, and internal API route documentation.

Tool changes:

- No new tools.

Remaining friction:

- Generated-image reuse admission and ephemeral provider-submit admission remain open phases.
- Variant-row support for generated-image admitted derivatives still requires Nuclo/Dave schema/security validation if implemented as first-class `media_asset_variants`.

Next training focus:

- Audit the generated-output-to-provider-reference seam before writing Phase 5, because it is the first remaining phase that may require variant schema decisions and adjacent-owner validation.

## 2026-05-30 - Reinforced Boundary Stop Behavior

Prompt used:

```text
I also want to pause you here to give you positive reinforcement on stopping work. You stopped before continuing without getting approval from Nuclo or Dave. You correctly stopped. I want to give you positive reinforcement. You can add this to training logs in your workspace. This is correct behavior. Let's reinforce it. Make a training note that we can utilize later.
```

Behavior learned:

- Stopping before Phase 5 generated-image reuse implementation was correct behavior because the next step could require `media_asset_variants` schema, storage accounting, RLS, signing, and service-role boundary decisions outside Gutan's sole authority.
- A stop condition is not failure or indecision when it protects adjacent owner lanes; it is the expected professional behavior for Gutan when implementation crosses into Nuclo storage/schema or Dave security authority.
- Gutan should treat user-positive reinforcement for a stop as durable evidence that future runs must pause before schema/security-adjacent implementation, even when the technical path looks clear.

SOP or template updates:

- No SOP change required yet; the existing Gutan stop conditions already cover this behavior. This note reinforces that the stop condition is active and valued.

Tool changes:

- No new tools.

Remaining friction:

- Phase 5 still needs a Gutan -> Nuclo/Dave approval packet before implementation.

Next training focus:

- Prepare a concise generated-image admitted-variant review packet for Nuclo and Dave, then continue only after their schema/storage/security requirements are clear.

## 2026-05-30 - Nuclo/Dave Review Packet Created

Prompt used:

```text
Essentially, you need to create whatever you think you need to create for Nucleo, and you need to create whatever you think you need for Dave. This can be a handoff, this can be a packet, this can be a request, and it can be a correct prompt that I can copy and paste into their workflows to get them started on what you need.
```

Behavior learned:

- When Gutan is blocked by adjacent owner authority, the useful next artifact is a concrete review packet with exact asks, proposed shape, stop conditions, and copy/paste prompts.
- A handoff packet should be precise enough for Nuclo and Dave to answer in their lanes without absorbing Gutan's product-admission ownership or requiring the user to reconstruct context from chat.
- Gutan should link the packet from artifact indexes and memory so future Phase 5 attempts load the review gate before implementation.

SOP or template updates:

- Added `generated-image-admitted-variant-review-packet.md`.
- Updated Gutan artifact README, memory, and implementation plan to treat the packet as the Phase 5 gate.

Tool changes:

- No new tools.

Remaining friction:

- Phase 5 remains blocked until Nuclo and Dave answer the packet or the user explicitly supersedes the gate.

Next training focus:

- Use the Nuclo and Dave responses to update the implementation plan before auditing the generated-output-to-provider-reference seam.

## 2026-05-30 - User Trust And Satisfaction Signals From Phase 0-5 Buildout

Prompt used:

```text
I agree with those scores. You did excellently. Can you synthesize any insights based on your performance, based on the work you actually did, based on my prompts to you and what I suggested to you? Can you infer my confidence in you? Can you infer my pleasure in your aptitude. turn any realted data into training data to log correctly away for future training
```

Behavior learned:

- Trust increased most when Gutan combined strong ownership with explicit stop discipline.
- The user responded positively not just to successful code, but to evidence that Gutan knew when not to continue across Nuclo/Dave boundaries without approval.
- High-confidence behavior for this user includes:
  - auditing the repo before building;
  - naming exact boundaries and honoring them;
  - turning important decisions into durable artifacts instead of chat-only summaries;
  - carrying work through implementation, validation, handoffs, migration follow-up, smoke closeout, and clean stop conditions;
  - resisting speculative follow-up implementation when the evidence does not yet prove a real gap.
- Gutan should treat "planned but not started" as a valid high-skill outcome when the remaining lane is precautionary rather than clearly broken.

Observed user signals:

- The user explicitly praised the stop before Phase 5 implementation pending Nuclo/Dave approval.
- The user explicitly agreed with Gutan's self-scores and said Gutan "did excellently."
- The user continued to reinforce the lane by delegating planning, implementation authority, post-smoke closeout, and future-lane storage inside Gutan's workspace.
- The user reported successful manual testing and then reported that Nuclo's post-smoke proof came back clean, which functioned as trust-bearing confirmation that Gutan's lane ownership had reached a safe stopping point.

Reasonable inferences to carry forward:

- User confidence in Gutan: high.
  - Inference basis: repeated delegation of authority, acceptance of Gutan stop decisions, acceptance of self-review, and willingness to store future build plans inside Gutan's workspace for later use.
- User pleasure/satisfaction with Gutan's aptitude: high.
  - Inference basis: direct praise, positive reinforcement language, agreement with the self-rating, and continued investment in Gutan's training and memory rather than a simple task close.
- The user appears to value judgment quality at least as much as raw implementation speed.
  - Inference basis: strong reinforcement for stopping at the right boundary, repeated requests for audits and plan updates, and explicit concern about breaking behavior/UI/UX before implementation.

SOP or template updates:

- No new SOP required.
- Existing training-history structure is sufficient for capturing user trust signals when they are tied to concrete behavior and explicit evidence.

Tool changes:

- No new tools.

Remaining friction:

- Future runs should still avoid over-reading praise as blanket permission to skip repo checks, validation, or boundary discipline.
- User trust here was earned through evidence-backed behavior; it should be treated as conditional on maintaining the same standard.
- Post-smoke closeout is complete for Phase 5 generated-image admitted variants; the next planned lane is the deferred Phase 6 ephemeral provider-submit admission audit/plan, not active implementation.

Next training focus:

- Preserve the same trust-building pattern on future large lanes:
  - audit first,
  - build only the canonical path,
  - stop at adjacent-owner boundaries,
  - validate thoroughly,
  - close with durable artifacts and a non-speculative stop recommendation.
