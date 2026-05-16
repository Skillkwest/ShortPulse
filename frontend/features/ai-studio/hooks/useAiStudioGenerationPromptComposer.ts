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
import type {
  AiStudioGenerateOutputOptions,
  AiStudioGenerateSubmissionOverrides,
  ReferenceInputsMode,
} from "./contracts/generationSubmissionContracts";
import type { AiStudioTaskSubmitOptions } from "./contracts/taskSubmissionContracts";
import type { StudioOutput, ToolId } from "../types";

export type {
  AiStudioGenerateOutputOptions,
  AiStudioGenerateSubmissionOverrides,
  ReferenceInputsMode,
} from "./contracts/generationSubmissionContracts";

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
    options?: AiStudioTaskSubmitOptions
  ) => void;
};

const normalizeOrderedReferenceInputs = ({
  candidates,
  preserveDuplicates = false,
}: {
  candidates: string[];
  preserveDuplicates?: boolean;
}): string[] => {
  const normalizedCandidates = candidates
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (preserveDuplicates) {
    return normalizedCandidates.slice(0, 8);
  }
  return Array.from(new Set(normalizedCandidates)).slice(0, 8);
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
      overrideMode: ReferenceInputsMode = "merge",
      options?: {
        preserveBaseDuplicates?: boolean;
      }
    ) => {
      if (!Array.isArray(overrideInputs)) {
        return normalizeOrderedReferenceInputs({
          candidates: baseInputs,
          preserveDuplicates: options?.preserveBaseDuplicates,
        });
      }
      if (overrideMode === "replace") {
        return normalizeOrderedReferenceInputs({
          candidates: overrideInputs,
          preserveDuplicates: true,
        });
      }
      return normalizeOrderedReferenceInputs({ candidates: [...overrideInputs, ...baseInputs] });
    },
    []
  );

  const generateOutput = useCallback(
    (promptOverride?: string | null, options?: AiStudioGenerateOutputOptions) => {
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
      const styleSuppressed = options?.suppressStyle === true;
      const compiledSubmissionPrompt = appendStylePromptToSubmission({
        tool: effectiveTool,
        submissionPrompt: submissionPromptToSubmit,
        selectedStylePrompt: styleSuppressed ? null : selectedStylePrompt,
        modelId: effectiveModelId,
        adapterEnabled: stylePromptFamilyAdapterEnabled,
      });
      const styleContextOverrideCandidate =
        options?.styleContextOverride ??
        (styleSuppressed ? undefined : selectedStyleContext) ??
        undefined;
      const styleContextOverrideToSubmit = shouldAttachStyleContextForTool(effectiveTool)
        ? styleContextOverrideCandidate
        : undefined;
      const { referenceImageUrl: referenceUrl, extraImageUrls: extraUrls } =
        resolveReferenceInputsForTool(effectiveTool);
      const isVideoGenerationTool = effectiveTool === "video" || effectiveTool === "kling";
      const baseInputs =
        effectiveTool === "image" || effectiveTool === "edit"
          ? buildImageReferenceInputs(referenceUrl, extraUrls, {
              preserveDuplicateExtras: true,
            })
          : isVideoGenerationTool
            ? buildVideoReferenceInputs(
                referenceUrl,
                extraUrls,
                videoReferenceMode,
                effectiveModelId
              )
            : [referenceUrl, ...extraUrls].filter((url): url is string => Boolean(url));
      const imageInputs = resolveMergedReferenceInputs(
        baseInputs,
        options?.referenceInputsOverride,
        options?.referenceInputsMode,
        {
          preserveBaseDuplicates: effectiveTool === "image" || effectiveTool === "edit",
        }
      );
      submitTask(compiledSubmissionPrompt, imageInputs, {
        modeOverride: options?.modeOverride,
        selectedToolOverride: options?.selectedToolOverride,
        displayPromptOverride: displayPromptToSubmit,
        displayedBilledCredits: options?.displayedBilledCredits,
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
      const effectiveTool = options?.selectedToolOverride ?? selectedTool;
      const promptForTool = resolvePromptForTool({
        tool: effectiveTool,
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
      const styleSuppressed = options?.suppressStyle === true;
      const compiledSubmissionPrompt = appendStylePromptToSubmission({
        tool: effectiveTool,
        submissionPrompt: submissionPromptToUse,
        selectedStylePrompt: styleSuppressed ? null : selectedStylePrompt,
        modelId: effectiveModelId,
        adapterEnabled: stylePromptFamilyAdapterEnabled,
      });
      const styleContextOverrideCandidate =
        options?.styleContextOverride ??
        (styleSuppressed ? undefined : selectedStyleContext) ??
        undefined;
      const styleContextOverrideToSubmit = shouldAttachStyleContextForTool(effectiveTool)
        ? styleContextOverrideCandidate
        : undefined;
      const { referenceImageUrl: referenceUrl, extraImageUrls: extraUrls } =
        resolveReferenceInputsForTool(effectiveTool);
      const referencePool = buildRegenerateReferencePool({
        selectedTool: effectiveTool,
        useReferenceImageIndicator,
        activeOutputPreviewUrl,
        referenceUrl,
        extraUrls,
        videoReferenceMode,
        videoModelId: effectiveModelId,
      });
      const imageInputs = resolveMergedReferenceInputs(
        referencePool,
        options?.referenceInputsOverride,
        options?.referenceInputsMode,
        {
          preserveBaseDuplicates: effectiveTool === "image" || effectiveTool === "edit",
        }
      );
      submitTask(compiledSubmissionPrompt, imageInputs, {
        selectedToolOverride: effectiveTool,
        displayPromptOverride: displayPromptToUse,
        displayedBilledCredits: options?.displayedBilledCredits,
        characterContextOverride: options?.characterContextOverride,
        modelIdOverride: options?.modelIdOverride,
        outputIdOverride: options?.outputIdOverride,
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
