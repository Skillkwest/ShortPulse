/**
 * Replay snapshot helpers for AI Studio generation reroll behavior.
 */
import type {
  GenerationReplayConfigV1,
  GenerationReplaySubmitTool,
  StudioOutput,
  ToolId,
} from "../types";

type BuildGenerationReplayConfigV1Input = {
  mode: StudioOutput["mode"];
  submitTool: ToolId | null;
  modelId: string;
  displayPrompt: string;
  submissionPrompt: string;
  aspect: string;
  imageResolution: string | null;
  referenceInputs: string[];
  characterContext?: StudioOutput["characterContext"];
  capturedAt?: string;
};

const isReplaySubmitTool = (value: unknown): value is GenerationReplaySubmitTool =>
  value === "create" || value === "image" || value === "edit";

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNormalizedReferenceInputs = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 8);
};

export const buildGenerationReplayConfigV1 = ({
  mode,
  submitTool,
  modelId,
  displayPrompt,
  submissionPrompt,
  aspect,
  imageResolution,
  referenceInputs,
  characterContext,
  capturedAt,
}: BuildGenerationReplayConfigV1Input): GenerationReplayConfigV1 | null => {
  if (mode !== "image") return null;
  if (!isReplaySubmitTool(submitTool)) return null;
  const normalizedModelId = asTrimmedString(modelId);
  const normalizedAspect = asTrimmedString(aspect);
  if (!normalizedModelId || !normalizedAspect) return null;
  const normalizedCapturedAt = asTrimmedString(capturedAt) ?? new Date().toISOString();
  return {
    version: 1,
    mode: "image",
    submitTool,
    modelId: normalizedModelId,
    displayPrompt: typeof displayPrompt === "string" ? displayPrompt : "",
    submissionPrompt: typeof submissionPrompt === "string" ? submissionPrompt : "",
    aspect: normalizedAspect,
    imageResolution: typeof imageResolution === "string" ? imageResolution : null,
    referenceInputs: toNormalizedReferenceInputs(referenceInputs),
    ...(characterContext ? { characterContext } : {}),
    capturedAt: normalizedCapturedAt,
  };
};

export const isGenerationReplayConfigV1 = (value: unknown): value is GenerationReplayConfigV1 => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    candidate.mode === "image" &&
    isReplaySubmitTool(candidate.submitTool) &&
    asTrimmedString(candidate.modelId) != null &&
    typeof candidate.displayPrompt === "string" &&
    typeof candidate.submissionPrompt === "string" &&
    asTrimmedString(candidate.aspect) != null &&
    (candidate.imageResolution === null || typeof candidate.imageResolution === "string") &&
    Array.isArray(candidate.referenceInputs) &&
    candidate.referenceInputs.every((item) => typeof item === "string") &&
    asTrimmedString(candidate.capturedAt) != null
  );
};

export const canRerollOutput = (output: StudioOutput): boolean => {
  if (output.mode !== "image") return false;
  if (output.mediaSource !== "generated") return false;
  return isGenerationReplayConfigV1(output.generationReplay);
};
