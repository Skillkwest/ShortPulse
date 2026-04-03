/**
 * AI Studio generation prompt/reference composition hook.
 * Owns prompt selection and ordered reference input composition for generate/regenerate submit paths.
 */
import { useCallback } from "react";
import {
  buildImageReferenceInputs,
  buildRegenerateReferencePool,
  buildVideoReferenceInputs,
} from "../logic/referenceInputs";
import {
  appendStylePromptToSubmission,
  isStylePromptFamilyAdapterEnabled,
} from "../logic/stylePromptAdapter";
import type { InpaintSubmissionOverride } from "../logic/inpaintSubmission";
import type { StudioMode, StudioOutput, ToolId } from "../types";

export type ReferenceInputsMode = "merge" | "replace";

export type AiStudioGenerateSubmissionOverrides = {
  submissionPromptOverride?: string | null;
  displayPromptOverride?: string | null;
  referenceInputsOverride?: string[];
  referenceInputsMode?: ReferenceInputsMode;
  characterContextOverride?: StudioOutput["characterContext"];
  styleContextOverride?: StudioOutput["styleContext"];
  outputIdOverride?: string;
  modelIdOverride?: string | null;
  inpaintOverride?: InpaintSubmissionOverride | null;
  hideOutputFromReferenceGrid?: boolean;
};

type GenerateOutputOptions = {
  modeOverride?: StudioMode;
  selectedToolOverride?: ToolId | null;
} & AiStudioGenerateSubmissionOverrides;

type UseAiStudioGenerationPromptComposerParams = {
  model: string | null;
  prompt: string;
  editReferenceText: string;
  videoReferenceText: string;
  selectedStylePrompt?: string | null;
  selectedStyleContext?: StudioOutput["styleContext"] | null;
  selectedTool: ToolId | null;
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  useReferenceImageIndicator: boolean;
  activeOutputPreviewUrl: string | null;
  resolveReferenceInputsForTool: (tool: ToolId | null) => {
    referenceImageUrl: string | null;
    extraImageUrls: [string | null, string | null, string | null];
  };
  submitTask: (
    promptText: string,
    imageInputs: string[],
    options?: {
      modeOverride?: StudioMode;
      selectedToolOverride?: ToolId | null;
      displayPromptOverride?: string | null;
      characterContextOverride?: StudioOutput["characterContext"];
      styleContextOverride?: StudioOutput["styleContext"];
      outputIdOverride?: string;
      modelIdOverride?: string | null;
      inpaintOverride?: InpaintSubmissionOverride | null;
      hideOutputFromReferenceGrid?: boolean;
    }
  ) => void;
};

const resolvePromptForTool = ({
  tool,
  prompt,
  editReferenceText,
  videoReferenceText,
}: {
  tool: ToolId | null;
  prompt: string;
  editReferenceText: string;
  videoReferenceText: string;
}): string => {
  const referencePromptForTool =
    tool === "video" || tool === "kling" ? videoReferenceText : editReferenceText;
  if (tool === "image" || tool === "edit" || tool === "video" || tool === "kling") {
    return referencePromptForTool;
  }
  return prompt;
};

const shouldAttachStyleContextForTool = (tool: ToolId | null): boolean =>
  tool === "create" || tool === "text" || tool === "image" || tool === "edit";

/**
 * Returns generate/regenerate handlers with stable prompt and reference composition rules.
 */
export const useAiStudioGenerationPromptComposer = ({
  model,
  prompt,
  editReferenceText,
  videoReferenceText,
  selectedStylePrompt = null,
  selectedStyleContext = null,
  selectedTool,
  videoReferenceMode,
  useReferenceImageIndicator,
  activeOutputPreviewUrl,
  resolveReferenceInputsForTool,
  submitTask,
}: UseAiStudioGenerationPromptComposerParams) => {
  const stylePromptFamilyAdapterEnabled = isStylePromptFamilyAdapterEnabled();
  const resolveMergedReferenceInputs = useCallback(
    (
      baseInputs: string[],
      overrideInputs?: string[],
      overrideMode: ReferenceInputsMode = "merge"
    ) => {
      const normalizeReferenceInputs = (candidates: string[]) =>
        Array.from(
          new Set(candidates.map((value) => value.trim()).filter((value) => value.length > 0))
        ).slice(0, 8);
      if (!Array.isArray(overrideInputs)) {
        return normalizeReferenceInputs(baseInputs);
      }
      if (overrideMode === "replace") {
        return normalizeReferenceInputs(overrideInputs);
      }
      return normalizeReferenceInputs([...overrideInputs, ...baseInputs]);
    },
    []
  );

  const generateOutput = useCallback(
    (promptOverride?: string | null, options?: GenerateOutputOptions) => {
      const effectiveTool = options?.selectedToolOverride ?? selectedTool;
      const defaultPromptForTool = resolvePromptForTool({
        tool: effectiveTool,
        prompt,
        editReferenceText,
        videoReferenceText,
      });
      const displayPromptToSubmit =
        typeof options?.displayPromptOverride === "string"
          ? options.displayPromptOverride
          : typeof promptOverride === "string"
            ? promptOverride
            : defaultPromptForTool;
      const submissionPromptToSubmit =
        typeof options?.submissionPromptOverride === "string"
          ? options.submissionPromptOverride
          : displayPromptToSubmit;
      const effectiveModelId = options?.modelIdOverride ?? model;
      const compiledSubmissionPrompt = appendStylePromptToSubmission({
        tool: effectiveTool,
        submissionPrompt: submissionPromptToSubmit,
        selectedStylePrompt,
        modelId: effectiveModelId,
        adapterEnabled: stylePromptFamilyAdapterEnabled,
      });
      const styleContextOverrideCandidate =
        options?.styleContextOverride ?? selectedStyleContext ?? undefined;
      const styleContextOverrideToSubmit = shouldAttachStyleContextForTool(effectiveTool)
        ? styleContextOverrideCandidate
        : undefined;
      const { referenceImageUrl: referenceUrl, extraImageUrls: extraUrls } =
        resolveReferenceInputsForTool(effectiveTool);
      const isVideoGenerationTool = effectiveTool === "video" || effectiveTool === "kling";
      const baseInputs =
        effectiveTool === "image" || effectiveTool === "edit"
          ? buildImageReferenceInputs(referenceUrl, extraUrls)
          : isVideoGenerationTool
            ? buildVideoReferenceInputs(referenceUrl, extraUrls, videoReferenceMode)
            : [referenceUrl, ...extraUrls].filter((url): url is string => Boolean(url));
      const imageInputs = resolveMergedReferenceInputs(
        baseInputs,
        options?.referenceInputsOverride,
        options?.referenceInputsMode
      );
      submitTask(compiledSubmissionPrompt, imageInputs, {
        modeOverride: options?.modeOverride,
        selectedToolOverride: options?.selectedToolOverride,
        displayPromptOverride: displayPromptToSubmit,
        characterContextOverride: options?.characterContextOverride,
        modelIdOverride: options?.modelIdOverride,
        inpaintOverride: options?.inpaintOverride,
        hideOutputFromReferenceGrid: options?.hideOutputFromReferenceGrid,
        ...(styleContextOverrideToSubmit
          ? {
              styleContextOverride: styleContextOverrideToSubmit,
            }
          : {}),
        ...(typeof options?.outputIdOverride === "string"
          ? { outputIdOverride: options.outputIdOverride }
          : {}),
      });
    },
    [
      editReferenceText,
      model,
      prompt,
      resolveReferenceInputsForTool,
      resolveMergedReferenceInputs,
      selectedTool,
      selectedStylePrompt,
      selectedStyleContext,
      stylePromptFamilyAdapterEnabled,
      submitTask,
      videoReferenceMode,
      videoReferenceText,
    ]
  );

  const regenerateOutput = useCallback(
    (options?: AiStudioGenerateSubmissionOverrides) => {
      const promptForTool = resolvePromptForTool({
        tool: selectedTool,
        prompt,
        editReferenceText,
        videoReferenceText,
      });
      const displayPromptToUse =
        typeof options?.displayPromptOverride === "string"
          ? options.displayPromptOverride.trim()
          : promptForTool.trim();
      const submissionPromptToUse =
        typeof options?.submissionPromptOverride === "string"
          ? options.submissionPromptOverride.trim()
          : displayPromptToUse;
      const effectiveModelId = options?.modelIdOverride ?? model;
      const compiledSubmissionPrompt = appendStylePromptToSubmission({
        tool: selectedTool,
        submissionPrompt: submissionPromptToUse,
        selectedStylePrompt,
        modelId: effectiveModelId,
        adapterEnabled: stylePromptFamilyAdapterEnabled,
      });
      const styleContextOverrideCandidate =
        options?.styleContextOverride ?? selectedStyleContext ?? undefined;
      const styleContextOverrideToSubmit = shouldAttachStyleContextForTool(selectedTool)
        ? styleContextOverrideCandidate
        : undefined;
      const { referenceImageUrl: referenceUrl, extraImageUrls: extraUrls } =
        resolveReferenceInputsForTool(selectedTool);
      const referencePool = buildRegenerateReferencePool({
        selectedTool,
        useReferenceImageIndicator,
        activeOutputPreviewUrl,
        referenceUrl,
        extraUrls,
        videoReferenceMode,
      });
      const imageInputs = resolveMergedReferenceInputs(
        referencePool,
        options?.referenceInputsOverride,
        options?.referenceInputsMode
      );
      submitTask(compiledSubmissionPrompt, imageInputs, {
        displayPromptOverride: displayPromptToUse,
        characterContextOverride: options?.characterContextOverride,
        modelIdOverride: options?.modelIdOverride,
        inpaintOverride: options?.inpaintOverride,
        hideOutputFromReferenceGrid: options?.hideOutputFromReferenceGrid,
        ...(styleContextOverrideToSubmit
          ? {
              styleContextOverride: styleContextOverrideToSubmit,
            }
          : {}),
      });
    },
    [
      activeOutputPreviewUrl,
      editReferenceText,
      model,
      prompt,
      resolveReferenceInputsForTool,
      resolveMergedReferenceInputs,
      selectedTool,
      selectedStylePrompt,
      selectedStyleContext,
      stylePromptFamilyAdapterEnabled,
      submitTask,
      useReferenceImageIndicator,
      videoReferenceMode,
      videoReferenceText,
    ]
  );

  return {
    generateOutput,
    regenerateOutput,
  };
};
