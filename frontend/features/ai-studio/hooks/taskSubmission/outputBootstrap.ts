/**
 * Pending output bootstrap helpers for generation submission.
 * Keeps placeholder creation and replay snapshot attachment out of the main submit hook.
 */
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../../../lib/model-runtime/openAiImage2";
import { buildGenerationReplayConfigV1 } from "../../logic/generationReplay";
import type {
  GenerationReplayConfig,
  StudioMode,
  StudioOutput,
  StudioOutputSubmissionMode,
  ToolId,
} from "../../types";

type BuildPendingSubmissionOutputParams = {
  id: string;
  outputMode: StudioMode;
  prompt: string;
  aspect: string;
  modelLabel: string;
  modelId: string;
  characterContext?: StudioOutput["characterContext"];
  styleContext?: StudioOutput["styleContext"];
  submissionTraceId: string;
  sourceRef: string;
  submissionMode: StudioOutputSubmissionMode;
  hiddenInReferenceGrid?: boolean;
};

type BuildSubmissionReplaySnapshotParams = {
  mode: StudioMode;
  submitTool: ToolId | null;
  modelId: string;
  displayPrompt: string;
  submissionPrompt: string;
  aspect: string;
  imageResolution: string | null;
  referenceInputs: string[];
  characterContext?: StudioOutput["characterContext"];
  styleContext?: StudioOutput["styleContext"];
};

export const buildPendingSubmissionOutput = ({
  id,
  outputMode,
  prompt,
  aspect,
  modelLabel,
  modelId,
  characterContext,
  styleContext,
  submissionTraceId,
  sourceRef,
  submissionMode,
  hiddenInReferenceGrid,
}: BuildPendingSubmissionOutputParams): StudioOutput => ({
  mode: outputMode,
  id,
  prompt,
  aspect,
  model: modelLabel,
  createdAt: new Date().toISOString(),
  modelId,
  status: "ready",
  taskState: "pending",
  timestamp: "Submitting...",
  errorMessage: null,
  errorMessageShort: null,
  errorDetail: null,
  mediaSource: "generated",
  previewTier: outputMode === "video" ? "preview_loop" : "full",
  archivedAt: null,
  archiveReason: null,
  saveState: "idle",
  saveError: null,
  characterContext,
  submissionTraceId,
  sourceRef,
  submissionMode,
  ...(styleContext ? { styleContext } : {}),
  ...(hiddenInReferenceGrid ? { hiddenInReferenceGrid: true } : {}),
});

export const resolveSubmissionModeForModelId = (
  modelId: string | null | undefined
): StudioOutputSubmissionMode =>
  modelId === OPENAI_GPT_IMAGE_2_MODEL_ID ? "direct-request" : "provider-task";

export const reconcilePendingSubmissionOutput = (
  prev: StudioOutput[],
  nextOutput: StudioOutput
): StudioOutput[] => {
  const existingIndex = prev.findIndex((item) => item.id === nextOutput.id);
  if (existingIndex === -1) return [nextOutput, ...prev];
  return prev.map((item) => (item.id === nextOutput.id ? { ...item, ...nextOutput } : item));
};

export const buildSubmissionReplaySnapshot = ({
  mode,
  submitTool,
  modelId,
  displayPrompt,
  submissionPrompt,
  aspect,
  imageResolution,
  referenceInputs,
  characterContext,
  styleContext,
}: BuildSubmissionReplaySnapshotParams) =>
  buildGenerationReplayConfigV1({
    mode,
    submitTool,
    modelId,
    displayPrompt,
    submissionPrompt,
    aspect,
    imageResolution,
    referenceInputs,
    characterContext,
    styleContext,
  });

export const attachGenerationReplayToOutput = ({
  id,
  generationReplay,
  updateOutputById,
}: {
  id: string;
  generationReplay: GenerationReplayConfig;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
}) => {
  updateOutputById(id, (item) => ({
    ...item,
    generationReplay,
  }));
};
