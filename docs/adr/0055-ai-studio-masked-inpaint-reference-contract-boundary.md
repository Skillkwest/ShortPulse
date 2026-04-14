# ADR 0055: AI Studio Masked Inpaint Reference Contract Boundary

- Status: Accepted
- Date: 2026-04-14
- Owners: AI Studio / Generation Runtime
- Related:
  - `docs/adr/0042-ai-studio-properties-panel-workflow-contract.md`
  - `docs/adr/0050-generation-pipeline-canonical-request-output-architecture.md`
  - `docs/api/api-fal-flux-pro-fill.md`
  - `docs/sops/sop_ai_studio_expert_edit_prompt_references.md`
  - `docs/sops/sop_image_generation.md`

## Context
Expert Edit now truthfully treats the current FLUX Fill inpaint lane as `@main`-only. The next product question is whether inpaint should evolve into a masked multi-reference workflow where the provider receives:

1. the primary base image,
2. the mask, and
3. secondary linked reference images from `@img1`, `@img2`, and `@img3`.

That requirement is stricter than ordinary multi-image edit. It needs one provider contract that preserves both:

1. explicit masked edit behavior, and
2. real secondary image conditioning inputs.

The current and audited candidate provider contracts do not line up cleanly:

1. `fal-ai/flux-pro/v1/fill` supports `image_url + mask_url` and no secondary image array.
2. Existing multi-image edit lanes already in the repo (`Seedream`, `Nano Banana`, `FLUX 2 edit`) support `image_urls`, but not a submit-time mask field.
3. Official Fal candidate `fal-ai/flux-kontext-lora/inpaint` supports `image_url + reference_image_url + mask_url`, but only one secondary reference input, not `@img1..@img3`.
4. Official Fal candidate `bria/fibo-edit/edit` supports `image_url + optional mask_url`, but no secondary image array.

This means the repo does not currently have a clean provider lane for the full requirement "`@main + @img1..@img3` as real masked inpaint inputs."

## Decision
1. Keep the canonical inpaint lane contract as `single base image + mask` until a provider cleanly supports masked multi-reference editing.
2. Do not overload the current inpaint lane with prompt-only or preflight-only secondary references.
3. Do not replace masked inpaint with a multi-image edit model that drops the mask contract while continuing to call the feature “inpaint.”
4. Do not silently degrade a future multi-reference promise from three secondary refs to one secondary ref.
5. Any future reference-aware masked editing must ship as a separate lane with its own explicit model, payload, pricing, polling, and token contract.
6. If product scope narrows to `@main + one secondary reference`, treat that as a different feature decision and evaluate `fal-ai/flux-kontext-lora/inpaint` explicitly instead of mutating the current FLUX Fill lane by implication.

## Consequences
- Positive:
  - The product contract stays truthful: inpaint means masked edit, not masked edit plus undocumented best-effort reference heuristics.
  - The prompt-linking system stays aligned with actual provider payloads.
  - Future implementation work gets a clean decision gate: either find a provider that supports masked multi-reference editing, or introduce a distinct lane with narrower semantics.
  - The repo avoids hacks such as reference montages, prompt-only “Figure N” conditioning without matching image payloads, or silent contract degradation.
- Negative:
  - The current system cannot satisfy the stronger user expectation “edit only the masked region and make it match `@img1..@img3`.”
  - Product may need a separate workflow or model lane if reference-aware masked editing becomes a priority.
- Follow-ups:
  - Keep `docs/api/api-fal-flux-pro-fill.md`, `docs/sops/sop_ai_studio_expert_edit_prompt_references.md`, and `docs/sops/sop_image_generation.md` aligned with the active inpaint contract.
  - If a future provider is evaluated for masked multi-reference editing, add a new ADR or supersede this one with the audited payload contract.

## Alternatives considered
1. Reuse existing multi-image edit models for inpaint and drop the mask.
   - Rejected: this changes the feature semantics and breaks the core masked-edit promise.
2. Keep FLUX Fill and continue compiling `@img1..@img3` into prompt text only.
   - Rejected: this is misleading because the provider never receives those images as conditioning inputs.
3. Concatenate multiple secondary references into one synthetic image.
   - Rejected: this is a brittle workaround, degrades intent fidelity, and creates an undocumented provider contract.
4. Switch inpaint to a single-reference masked model and map only one secondary token.
   - Rejected: the requirement under review is multi-reference masked editing, not a silent reduction to one linked reference.

## References
- [FLUX.1 [pro] Fill API](https://fal.ai/models/fal-ai/flux-pro/v1/fill/api)
- [Seedream 5.0 Lite guide: edit endpoint uses image URLs and no mask field](https://fal.ai/learn/tools/how-to-use-seedream-5-lite)
- [FLUX Kontext LoRA Inpaint API](https://fal.ai/models/fal-ai/flux-kontext-lora/inpaint/api)
- [Bria Fibo Edit API](https://fal.ai/models/bria/fibo-edit/edit/api)
