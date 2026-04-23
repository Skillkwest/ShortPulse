/**
 * Constants for the Character workflow (models, defaults, UI copy).
 */
import type { CharacterEngine, CharacterModelId, CharacterPose } from "./types";

export const characterModelOptions: { value: CharacterModelId; label: string }[] = [
  {
    value: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    label: "Seedream 4.5 (text→image)",
  },
  {
    value: "fal-ai/bytedance/seedream/v4.5/edit",
    label: "Seedream 4.5 Edit (image+prompt)",
  },
];

export const characterAspectOptions = ["1:1", "4:5", "3:4", "9:16", "16:9"] as const;

export const defaultCharacterModel: CharacterModelId =
  "fal-ai/bytedance/seedream/v4.5/text-to-image";
export const defaultCharacterEngine: CharacterEngine = "fal-edge";
export const defaultCharacterAspect = "4:5";

export const starterPoses: CharacterPose[] = [
  { id: "pose-standing", label: "Standing neutral" },
  { id: "pose-walking", label: "Walking forward" },
  { id: "pose-3-4", label: "3/4 hero" },
];

export const MAX_REFERENCE_FILES = 12;
