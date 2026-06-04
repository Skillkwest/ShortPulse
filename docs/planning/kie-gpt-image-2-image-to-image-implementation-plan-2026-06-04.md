# Kie GPT Image 2 Image-To-Image Implementation Plan

Date: 2026-06-04

Status: plan-ready, implementation not started.

## Goal

Add Kie.ai GPT Image 2 image-to-image support to AI Studio as a sibling queued edit model to the existing Kie GPT Image 2 text-to-image lane.

This plan is complete enough to begin implementation once the pricing decision below is confirmed. Stop after this plan is written and indexed; do not implement model code in the planning pass.

## Source Of Truth

- User-provided Kie.ai GPT Image 2 image-to-image API docs from the current task.
- Existing Kie GPT Image 2 text-to-image implementation and route pattern in the repo.
- Existing AI Studio model catalog, submission-handler, generated route, pricing, and docs conventions.

## In Scope

- Add a distinct catalog model for `kie-ai/gpt-image-2-image-to-image`.
- Submit to Kie provider model `gpt-image-2-image-to-image`.
- Use Kie `POST https://api.kie.ai/api/v1/jobs/createTask`.
- Poll through the same Kie job status shape used by the text-to-image lane, currently cataloged as `https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}`.
- Require `prompt` and at least one reference image.
- Submit references as `input.input_urls`, capped at the provider maximum of 16 images.
- Reuse the Kie GPT Image 2 aspect and resolution rules:
  - allowed aspects: `auto`, `1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `5:4`, `4:5`, `16:9`, `9:16`, `2:1`, `1:2`, `3:1`, `1:3`, `21:9`, `9:21`
  - allowed resolutions: `1K`, `2K`, `4K`
  - normalize `auto` aspect to `1K`
  - normalize `1:1 + 4K` to `2K`
- Expose the model in normal image-to-image/edit picker flows only.
- Keep Character Mode defaults unchanged.
- Add docs and tests needed for model catalog parity, route generation, provider payload normalization, result media extraction, pricing coverage, and submission adapter coverage.

## Out Of Scope

- No redesign of model picker layout, ordering mechanics, or right-rail behavior.
- No changes to OpenAI GPT Image 2 behavior.
- No changes to the existing Kie text-to-image route except the minimal symmetric pairing or shared-constant refactor needed to avoid duplication.
- No provider live-call validation unless explicitly requested.
- No Character Mode allowlist/default change unless explicitly requested.
- No new fallback transport, alternate proxy, or duplicate status path.

## Pricing Decision

The current repo already encodes Kie GPT Image 2 pricing as:

- `1K`: `$0.03`
- `2K`: `$0.05`
- `4K`: `$0.08`

The pasted image-to-image API docs did not include pricing. Before implementation, confirm one of these options:

- Reuse the existing `kie-gpt-image-2-per-image` strategy for image-to-image.
- Add a separate pricing strategy if Kie image-to-image has different provider pricing.

Do not ship the image-to-image model to billable picker/runtime surfaces without this decision.

## Implementation Steps

1. Add canonical ids and shared constants.
   - Add `KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID = "kie-ai/gpt-image-2-image-to-image"`.
   - Add provider model id `gpt-image-2-image-to-image`.
   - Refactor `kieGptImage2.ts` so shared allowed aspects, resolutions, defaults, prompt max, and normalization are not text-lane-only names.

2. Add catalog and runtime metadata.
   - Add a `modelCatalog.ts` base entry with Kie submit/status URLs, `payloadValidation`, `apiDocFile`, allowed aspects, allowed resolutions, default aspect, default resolution, and provider model id.
   - Add active runtime metadata with `mediaType: "image"`, `supportsImageToImage: true`, `generationLanes: ["image-to-image"]`, `executionMode: "queued"`, `submitHandler: "image"`, a new image submission adapter key, `gridEligible: true`, and a distinct route slug such as `kie-gpt-image-2-edit`.
   - Pair with the text-to-image Kie model only if the mapping is useful and does not alter Character Mode allowlists.

3. Add client image submission support.
   - Add a new image adapter key, for example `kie-gpt-image-2-edit`.
   - In `imageHandlers.ts`, submit:
     - `prompt`
     - `input_urls: preparedImageInputs.slice(0, 16)`
     - `aspect_ratio`
     - normalized `resolution`
     - existing ShortPulse context fields
   - Start polling with a distinct provider/route key that resolves back to the image-to-image model.
   - Keep the existing edit preflight and add adapter-level reference validation as defense-in-depth.

4. Add Kie server contract support.
   - Add a `normalizeKieGptImage2ImageToImagePayload` branch in `kieModelContracts.ts`.
   - Accept root or nested `input` payloads, normalize aliases to `input.input_urls`, require 1-16 URLs, require prompt, validate prompt max length, validate aspect/resolution, and validate callback URL.
   - Register the new model id in Kie supported model ids.
   - Confirm common Kie result extraction works for image result envelopes and add test coverage.

5. Add generated routes.
   - Add one route inventory row in `scripts/lib/fal_route_inventory.js`.
   - Run `npm -C frontend run fal:routes:sync`.
   - Do not hand-edit generated wrappers.

6. Add picker presentation metadata.
   - Add the model to GPT Image family resolution.
   - Add tooltip metadata and tags.
   - Add it to the image-edit model priority list if needed for intentional ordering.
   - Do not change modal layout, copy, or interaction behavior beyond making the new model selectable.

7. Add docs.
   - Add `docs/api/api-kie-gpt-image-2-image-to-image.md`.
   - Update API indexes, route docs, root/docs indexes, and AI Studio image-generation SOPs.
   - Keep the docs explicit that Kie text-to-image and Kie image-to-image are separate queued lanes.

8. Add/update tests and checks.
   - Kie model contract tests for payload normalization, nested input support, missing prompt, missing references, too many references, invalid aspect, invalid resolution, invalid callback URL, and provider-invalid resolution normalization.
   - Kie result media tests for image result extraction.
   - Submission adapter matrix tests for image handler alignment and `input_urls`.
   - Model API/catalog/pricing coverage tests.
   - Route inventory/generated wrapper checks.
   - Docs check.

## Validation Plan

Run targeted validation after implementation:

- `npm -C frontend run fal:routes:check`
- `npm -C frontend run model:doctor`
- `npm -C frontend run docs:check`
- Targeted Vitest suites covering:
  - Kie model contracts
  - Kie result media contracts
  - model API contracts
  - model pricing coverage
  - task submission payload matrix
  - model modal presentation/order if picker ordering changes

Run `npm -C frontend exec tsc -- --noEmit` only as a residual-risk check because the current worktree has known unrelated test-type failures.

## Stop Condition

Planning is complete when this document:

- Names the model id, provider model id, submit endpoint, status endpoint pattern, required fields, reference cap, aspect/resolution policy, and pricing decision gate.
- Identifies all implementation surfaces.
- Identifies what is intentionally out of scope.
- Defines validation commands.
- States that implementation must not start in the planning pass.

At that point, stop. Begin implementation only after the user explicitly asks to proceed and the pricing decision is confirmed or explicitly accepted as an implementation assumption.
