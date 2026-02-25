# AI Studio Create Character Mode Regression Matrix

## Matrix

| Scenario | Expected |
| --- | --- |
| Create/Image + Character Mode OFF + model picker open | Standard text-to-image Create models shown (no edit-only lock). |
| Create/Image + Character Mode ON + model picker open | Only `seedream/edit` and `nano-banana-pro/edit` shown. |
| Toggle OFF -> ON from `seedream/text-to-image` | Model remaps to `seedream/edit`. |
| Toggle OFF -> ON from `nano-banana-pro` | Model remaps to `nano-banana-pro/edit`. |
| Toggle OFF -> ON from any other Create model | Model remaps to `seedream/edit`. |
| Toggle ON -> OFF from `seedream/edit` | Model remaps to `seedream/text-to-image`. |
| Toggle ON -> OFF from `nano-banana-pro/edit` | Model remaps to `nano-banana-pro`. |
| Toggle ON -> OFF from unknown edit model | Model remaps to `seedream/text-to-image`. |
| Character Mode ON submit with refs + Seedream Edit | Submit uses composed prompt + `image_urls` and image handler route. |
| Character Mode ON submit with refs + Nano Banana Pro Edit | Submit uses composed prompt + `image_urls` and image handler route. |
| Character Mode ON submit without refs | Submit blocked with explicit UI error before provider submit. |
| Selected model supports image-to-image, refs normalize to empty | Submit fails fast and does not route to provider handler. |
| Character Mode OFF Create submit | Standard text-to-image path unchanged. |

## Evidence pointers
- Logic tests:
  - `frontend/features/ai-studio/logic/__tests__/createCharacterModeModelMapping.test.ts`
  - `frontend/features/ai-studio/logic/__tests__/modelSelectionPolicy.test.ts`
- Hook tests:
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioAllowedModelOptions.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioPageDerivations.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`
