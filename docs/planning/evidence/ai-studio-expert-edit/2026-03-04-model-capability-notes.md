# AI Studio Expert Edit: Fal Prompt Capability Notes (2026-03-04)

Purpose: lock prompt-requirement capability inputs for Expert Edit prompt policy implementation.

Capture date: 2026-03-04
Source policy: official Fal model API docs only.

## Evaluated Edit Models

| Model ID | Fal API doc | Prompt field status | Notes |
| --- | --- | --- | --- |
| `fal/flux-2/edit` (catalog alias `fal-ai/flux-2/edit`) | https://fal.ai/models/fal-ai/flux-2/edit/api | Required | Input schema lists `prompt` as required. |
| `fal/flux-2-pro/edit` (catalog alias `fal-ai/flux-2-pro/edit`) | https://fal.ai/models/fal-ai/flux-2-pro/edit/api | Required | Input schema lists `prompt` as required. |
| `fal-ai/nano-banana/edit` | https://fal.ai/models/fal-ai/nano-banana/edit/api | Required | Input schema lists `prompt` as required. |
| `fal-ai/nano-banana-2/edit` | https://fal.ai/models/fal-ai/nano-banana-2/edit/api | Required | Input schema lists `prompt` as required. |
| `fal-ai/nano-banana-pro/edit` | https://fal.ai/models/fal-ai/nano-banana-pro/edit/api | Required | Input schema lists `prompt` as required. |
| `fal-ai/bytedance/seedream/v4.5/edit` | https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/edit/api | Required | Input schema lists `prompt` as required. |
| `fal-ai/bytedance/seedream/v5/lite/edit` | https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/edit/api | Required | Input schema lists `prompt` as required. |

## Policy Outcome for Implementation

- Current known edit models in this repo are `required` for prompt.
- `resolveEditPromptRequirement(modelId)` should:
  - return `"required"` for all known edit models above,
  - return `"unknown"` for unrecognized model IDs,
  - treat `"unknown"` as required in submission guards.

## Operational Notes

- UI may still allow empty prompt text entry.
- Submission guard should raise explicit prompt-required error for required/unknown models.
- If Fal docs change later, update this evidence file and `editPromptPolicy.ts` mapping together.
