/**
 * AI Studio create-runtime prompt state.
 * Owns stable create/edit/video text setters plus create-mode prompt/runtime selection.
 */
import { useMemo } from "react";
import { useAiStudioStableTextSetters } from "./useAiStudioStableTextSetters";

type UseAiStudioCreateRuntimePromptStateParams = {
  activePulsePresetId: string | null;
  expertCreateMode: "standard" | "pulse";
  pulsePrompt: string;
  pulseSessionInstanceId: string | null;
  setEditReferenceTextState: (value: string) => void;
  setPulsePromptState: (value: string) => void;
  setStandardPromptState: (value: string) => void;
  setVideoReferenceTextState: (value: string) => void;
  standardPrompt: string;
};

/**
 * Returns prompt setters and derived create-runtime prompt state for AI Studio.
 */
export const useAiStudioCreateRuntimePromptState = ({
  activePulsePresetId,
  expertCreateMode,
  pulsePrompt,
  pulseSessionInstanceId,
  setEditReferenceTextState,
  setPulsePromptState,
  setStandardPromptState,
  setVideoReferenceTextState,
  standardPrompt,
}: UseAiStudioCreateRuntimePromptStateParams) => {
  const {
    setSharedPrompt,
    setStandardCreatePrompt,
    setPulseCreatePrompt,
    setEditReferenceText,
    setVideoReferenceText,
  } = useAiStudioStableTextSetters({
    expertCreateMode,
    setStandardPromptState,
    setPulsePromptState,
    setEditReferenceTextState,
    setVideoReferenceTextState,
  });

  const createStateRuntime = useMemo(
    () =>
      expertCreateMode === "pulse"
        ? {
            kind: "pulse" as const,
            prompt: pulsePrompt,
            activePulsePresetId,
            pulseSessionInstanceId,
          }
        : {
            kind: "standard" as const,
            prompt: standardPrompt,
            activePulsePresetId: null,
            pulseSessionInstanceId: null,
          },
    [activePulsePresetId, expertCreateMode, pulsePrompt, pulseSessionInstanceId, standardPrompt]
  );

  const createStatePrompts = useMemo(
    () => ({
      standard: standardPrompt,
      pulse: pulsePrompt,
    }),
    [pulsePrompt, standardPrompt]
  );

  return {
    activeCreatePrompt: createStateRuntime.prompt,
    createStatePrompts,
    createStateRuntime,
    setEditReferenceText,
    setPulseCreatePrompt,
    setSharedPrompt,
    setStandardCreatePrompt,
    setVideoReferenceText,
  };
};
