# AI Studio Create Character Mode Hardening Plan

Status: draft

## Goal
Harden Create Properties Character Mode so model selection, model remapping, and submit payload invariants stay consistent and regression-safe.

## Scope
- Create workflow only (`selectedTool: create|text`, `mode: image`).
- Character Mode behavior only.
- No backend contract changes.

## Behavior contract
1. Character Mode ON (Create/Image) allows only:
   - `fal-ai/bytedance/seedream/v4.5/edit`
   - `fal-ai/nano-banana-pro/edit`
2. Model remap on toggle:
   - OFF -> ON:
     - `seedream/text-to-image` -> `seedream/edit`
     - `nano-banana-pro` -> `nano-banana-pro/edit`
     - other -> `seedream/edit`
   - ON -> OFF:
     - `seedream/edit` -> `seedream/text-to-image`
     - `nano-banana-pro/edit` -> `nano-banana-pro`
     - other -> `seedream/text-to-image`
3. Character Mode ON submissions require character references:
   - Block submit if no character images.
   - Do not fall back to description-only submit.
4. Character Mode ON payload continues to include:
   - Provider prompt: `character description + user prompt`
   - `image_urls`: character references
   - UI prompt display: user prompt only
5. Character Mode OFF keeps normal Create text-to-image path.

## Implementation decisions
- Centralize Create Character Mode model mapping in one pure logic module.
- Reuse shared model policy (`resolveAiStudioAllowedModelOptions`) for both page derivations and state allowed-model guards.
- Keep safety checks at two levels:
  - generation-controller pre-submit block for Character Mode ON with no references
  - task-submission invariant for any selected image-to-image model with no references
- Preserve resolution as model-selectable input (no forced override in Character Mode).

## Tests added/updated
- Logic:
  - `createCharacterModeModelMapping` ON/OFF remap + allowed model checks
  - `modelSelectionPolicy` Character Mode ON filter behavior
- Hooks:
  - `useAiStudioAllowedModelOptions` Character Mode flag propagation
  - `useAiStudioPageDerivations` Character Mode Create model list
  - `useAiStudioGenerationController` blocks when Character Mode has no refs
  - `useAiStudioTaskSubmission` blocks create image-to-image submits without refs

## Risks and mitigations
- Risk: drift between UI model list and state-level model guard.
  - Mitigation: both use shared selection policy + shared mapping module.
- Risk: fallback submit paths silently bypass Character Mode invariants.
  - Mitigation: dual guard (generation controller + task submission).
- Risk: regressions for non-Create workflows.
  - Mitigation: scope checks to Create/Image + Character Mode path only.
