/**
 * Create workflow model pairing/mapping for Character Mode transitions.
 * Keeps Create model remap behavior centralized and deterministic.
 */
import {
  getModelCatalogEntry,
  getPairedModelId,
  listCreateCharacterModeModelIds,
  listModelCatalogEntries,
  resolveRequiredCreateCharacterModeStartupModelId,
  resolveRequiredCreateStartupModelId,
} from "../../../lib/model-runtime/modelCatalog";

export const CREATE_DEFAULT_MODEL_ID = resolveRequiredCreateStartupModelId();
export const CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID =
  resolveRequiredCreateCharacterModeStartupModelId();
export const CREATE_CHARACTER_MODE_ALLOWED_MODEL_IDS =
  listCreateCharacterModeModelIds() as readonly string[];

const CREATE_CHARACTER_MODE_ALLOWED_MODEL_ID_SET = new Set<string>(
  CREATE_CHARACTER_MODE_ALLOWED_MODEL_IDS
);

const CREATE_MODEL_PAIRS = listModelCatalogEntries()
  .filter((entry) => entry.supportsTextToImage === true && typeof entry.pairedModelId === "string")
  .map((entry) => ({
    textToImageModelId: entry.modelId,
    imageToImageModelId: entry.pairedModelId as string,
  }));

const TEXT_TO_EDIT_MODEL_MAP = new Map<string, string>(
  CREATE_MODEL_PAIRS.map((pair) => [pair.textToImageModelId, pair.imageToImageModelId])
);

/**
 * Returns `true` when a model is one of the Create Character Mode image-to-image models.
 */
export const isCreateCharacterModeModel = (modelId: string | null | undefined): boolean => {
  if (!modelId) return false;
  const normalizedModelId = modelId.trim();
  if (!normalizedModelId) return false;
  return CREATE_CHARACTER_MODE_ALLOWED_MODEL_ID_SET.has(normalizedModelId);
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
    if (currentModelId) {
      const normalizedModelId = currentModelId.trim();
      const pairedModelId = getPairedModelId(normalizedModelId);
      const entry = getModelCatalogEntry(normalizedModelId);
      if (entry?.supportsTextToImage && pairedModelId) {
        return pairedModelId;
      }
    }
    if (currentModelId && isCreateCharacterModeModel(currentModelId)) {
      return currentModelId;
    }
    return CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID;
  }

  if (currentModelId) {
    const normalizedModelId = currentModelId.trim();
    const pairedModelId = getPairedModelId(normalizedModelId);
    const entry = getModelCatalogEntry(normalizedModelId);
    if (entry?.supportsImageToImage && pairedModelId) {
      return pairedModelId;
    }
    if (entry?.supportsImageToImage && entry?.supportsTextToImage) {
      return normalizedModelId;
    }
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
  const normalizedModelId = currentModelId.trim();
  if (isCreateCharacterModeModel(normalizedModelId)) return normalizedModelId;
  return TEXT_TO_EDIT_MODEL_MAP.get(normalizedModelId) ?? CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID;
};
