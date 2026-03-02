/**
 * Create workflow model pairing/mapping for Character Mode transitions.
 * Keeps Create model remap behavior centralized and deterministic.
 */
export const CREATE_DEFAULT_MODEL_ID = "fal-ai/bytedance/seedream/v4.5/text-to-image";
export const CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID = "fal-ai/bytedance/seedream/v4.5/edit";
export const CREATE_CHARACTER_MODE_ALLOWED_MODEL_IDS = [
  CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID,
  "fal-ai/bytedance/seedream/v5/lite/edit",
  "fal-ai/nano-banana-2/edit",
  "fal-ai/nano-banana-pro/edit",
] as const;

const CREATE_CHARACTER_MODE_ALLOWED_MODEL_ID_SET = new Set<string>(
  CREATE_CHARACTER_MODE_ALLOWED_MODEL_IDS
);

const CREATE_MODEL_PAIRS = [
  {
    textToImageModelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    imageToImageModelId: "fal-ai/bytedance/seedream/v4.5/edit",
  },
  {
    textToImageModelId: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    imageToImageModelId: "fal-ai/bytedance/seedream/v5/lite/edit",
  },
  {
    textToImageModelId: "fal-ai/nano-banana-2",
    imageToImageModelId: "fal-ai/nano-banana-2/edit",
  },
  {
    textToImageModelId: "fal-ai/nano-banana-pro",
    imageToImageModelId: "fal-ai/nano-banana-pro/edit",
  },
] as const;

const TEXT_TO_EDIT_MODEL_MAP = new Map<string, string>(
  CREATE_MODEL_PAIRS.map((pair) => [pair.textToImageModelId, pair.imageToImageModelId])
);
const EDIT_TO_TEXT_MODEL_MAP = new Map<string, string>(
  CREATE_MODEL_PAIRS.map((pair) => [pair.imageToImageModelId, pair.textToImageModelId])
);

/**
 * Returns `true` when a model is one of the Create Character Mode image-to-image models.
 */
export const isCreateCharacterModeModel = (modelId: string | null | undefined): boolean => {
  if (!modelId) return false;
  return CREATE_CHARACTER_MODE_ALLOWED_MODEL_ID_SET.has(modelId);
};

/**
 * Returns the allowed Create models while Character Mode is enabled.
 */
export const getCreateCharacterModeAllowedModels = (): readonly string[] =>
  CREATE_CHARACTER_MODE_ALLOWED_MODEL_IDS;

/**
 * Maps the current Create model when Character Mode toggles ON/OFF.
 */
export const mapCreateModelOnCharacterModeToggle = ({
  currentModelId,
  isCharacterModeEnabled,
}: {
  currentModelId: string | null;
  isCharacterModeEnabled: boolean;
}): string => {
  if (isCharacterModeEnabled) {
    if (currentModelId && TEXT_TO_EDIT_MODEL_MAP.has(currentModelId)) {
      return TEXT_TO_EDIT_MODEL_MAP.get(currentModelId) ?? CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID;
    }
    if (currentModelId && isCreateCharacterModeModel(currentModelId)) {
      return currentModelId;
    }
    return CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID;
  }

  if (currentModelId && EDIT_TO_TEXT_MODEL_MAP.has(currentModelId)) {
    return EDIT_TO_TEXT_MODEL_MAP.get(currentModelId) ?? CREATE_DEFAULT_MODEL_ID;
  }
  if (currentModelId && TEXT_TO_EDIT_MODEL_MAP.has(currentModelId)) {
    return currentModelId;
  }
  return CREATE_DEFAULT_MODEL_ID;
};

/**
 * Resolves the effective Create submit model for Character Mode safety.
 * ON: coerces text-to-image models to paired edit models.
 * OFF: leaves selected model unchanged.
 */
export const resolveCreateCharacterModeSubmitModel = ({
  currentModelId,
  isCharacterModeEnabled,
}: {
  currentModelId: string | null;
  isCharacterModeEnabled: boolean;
}): string | null => {
  if (!isCharacterModeEnabled) return currentModelId;
  if (!currentModelId) return CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID;
  if (isCreateCharacterModeModel(currentModelId)) return currentModelId;
  return TEXT_TO_EDIT_MODEL_MAP.get(currentModelId) ?? CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID;
};
