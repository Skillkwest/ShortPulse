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

export type AiStudioGenerateSubmissionOverrides = {
  submissionPromptOverride?: string | null;
  displayPromptOverride?: string | null;
  referenceInputsOverride?: string[];
  characterContextOverride?: StudioOutput["characterContext"];
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
  selectedTool: ToolId | null;
  videoReferenceMode: "standard" | "keyframes" | "kling3" | "motion";
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

/**
 * Returns generate/regenerate handlers with stable prompt and reference composition rules.
 */
export const useAiStudioGenerationPromptComposer = ({
  model,
  prompt,
  editReferenceText,
  videoReferenceText,
  selectedStylePrompt = null,
  selectedTool,
  videoReferenceMode,
  useReferenceImageIndicator,
  activeOutputPreviewUrl,
  resolveReferenceInputsForTool,
  submitTask,
}: UseAiStudioGenerationPromptComposerParams) => {
  const stylePromptFamilyAdapterEnabled = isStylePromptFamilyAdapterEnabled();
  const resolveMergedReferenceInputs = useCallback(
    (baseInputs: string[], overrideInputs?: string[]) => {
      if (!Array.isArray(overrideInputs)) {
        return baseInputs.slice(0, 8);
      }
      const merged = [...overrideInputs, ...baseInputs]
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      return Array.from(new Set(merged)).slice(0, 8);
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
        options?.referenceInputsOverride
      );
      submitTask(compiledSubmissionPrompt, imageInputs, {
        modeOverride: options?.modeOverride,
        selectedToolOverride: options?.selectedToolOverride,
        displayPromptOverride: displayPromptToSubmit,
        characterContextOverride: options?.characterContextOverride,
        modelIdOverride: options?.modelIdOverride,
        inpaintOverride: options?.inpaintOverride,
        hideOutputFromReferenceGrid: options?.hideOutputFromReferenceGrid,
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
        options?.referenceInputsOverride
      );
      submitTask(compiledSubmissionPrompt, imageInputs, {
        displayPromptOverride: displayPromptToUse,
        characterContextOverride: options?.characterContextOverride,
        modelIdOverride: options?.modelIdOverride,
        inpaintOverride: options?.inpaintOverride,
        hideOutputFromReferenceGrid: options?.hideOutputFromReferenceGrid,
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
