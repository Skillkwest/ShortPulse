# ADR 0056: AI Studio Single-Reference Masked Inpaint Lane

- Status: Accepted
- Date: 2026-04-14
- Owners: AI Studio / Generation Runtime
- Related:
  - `docs/adr/0055-ai-studio-masked-inpaint-reference-contract-boundary.md`
  - `docs/api/api-fal-flux-pro-fill.md`
  - `docs/sops/sop_ai_studio_expert_edit_prompt_references.md`
  - `docs/sops/sop_image_generation.md`

## Context
ADR 0055 kept the canonical inpaint contract truthful: FLUX Fill is a masked edit lane that accepts only the base image plus mask. It also left one narrower path open: if product scope narrowed to `@main + one secondary reference`, we could evaluate `fal-ai/flux-kontext-lora/inpaint` as a separate feature instead of mutating FLUX Fill.

That narrower feature is now required. The user-facing need is:

1. preserve masked-edit behavior,
2. allow one linked secondary visual reference, and
3. keep the current FLUX Fill lane intact for ordinary inpaint.

The audited Fal contract for `fal-ai/flux-kontext-lora/inpaint` matches that narrowed requirement:

1. `image_url`
2. `mask_url`
3. `reference_image_url`

It does not support multiple secondary reference images.

## Decision
1. Keep FLUX Fill (`fal-ai/flux-pro/v1/fill`) as the default inpaint lane.
2. Introduce a separate masked inpaint lane for exactly one secondary reference using `fal-ai/flux-kontext-lora/inpaint`.
3. Resolve the effective inpaint model from prompt-link state:
   - no linked secondary reference: use FLUX Fill,
   - exactly one unique linked `@imgN`: use Kontext Inpaint,
   - more than one unique linked `@imgN`: block submit with a lane-specific validation error.
4. Keep prompt authoring, pricing, payload assembly, and polling aligned to the same lane decision.
5. Keep normal inpaint preflight override-authoritative: when `inpaintOverride` exists, prepare only override media (`baseImageInput`, `maskInput`, optional `referenceImageInput`) instead of normal edit `imageInputs`.

## Consequences
- Positive:
  - The product gains an honest masked-reference workflow without breaking the FLUX Fill contract.
  - The prompt picker, pricing, and provider payload all derive from one inpaint lane decision.
  - Secondary references are transmitted only when the provider lane can actually receive them.
- Negative:
  - The feature remains explicitly single-reference only; `@img1 + @img2` is still invalid in masked inpaint.
  - There is now one more hidden internal model, pricing strategy, and polling provider token to maintain.
- Guardrails:
  - Do not silently collapse multiple linked secondary references into one.
  - Do not regress default inpaint into a prompt-only reference heuristic.

## Alternatives considered
1. Replace FLUX Fill entirely with Kontext Inpaint.
   - Rejected: default inpaint should remain the simpler, existing lane.
2. Allow multiple secondary prompt references and ignore extras.
   - Rejected: silent degradation is misleading and conflicts with ADR 0055.
3. Keep the feature UI-only and continue dropping secondary refs at submit.
   - Rejected: this recreates the original payload mismatch.

## References
- [FLUX.1 [pro] Fill API](https://fal.ai/models/fal-ai/flux-pro/v1/fill/api)
- [FLUX Kontext LoRA Inpaint API](https://fal.ai/models/fal-ai/flux-kontext-lora/inpaint/api)
