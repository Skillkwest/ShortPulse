import React from "react";

import {
  analyzeExpertEditPromptTokens,
  buildExpertEditPromptHighlightSegments,
} from "../../logic/expertEditPromptReferences";
import { secondaries } from "./expertEditPanelViewContract";
import {
  autoResizeTextareaWithinComputedBounds,
  resolveTextareaVisualRowCount,
  syncTextareaMirrorScroll,
} from "./expertEditInteractionUtils";
import {
  useExpertEditPromptTokenPickerRuntime,
  type PromptTokenPickerSelection,
} from "./useExpertEditPromptTokenPickerRuntime";

type UseExpertEditPromptTokenControllerArgs = {
  promptTextValue: string;
  extraImageUrls: readonly (string | null)[];
  populatedLayerCount: number;
  allowSecondaryReferenceTokens?: boolean;
  maxSecondaryReferenceTokens?: number;
  isPromptComposerExpanded: boolean;
  onPromptTextChange: (value: string) => void;
  showStatusToast: (message: string, tone?: "info" | "warning") => void;
};

export function useExpertEditPromptTokenController({
  promptTextValue,
  extraImageUrls,
  populatedLayerCount,
  allowSecondaryReferenceTokens = true,
  maxSecondaryReferenceTokens,
  isPromptComposerExpanded,
  onPromptTextChange,
  showStatusToast,
}: UseExpertEditPromptTokenControllerArgs) {
  const promptInputShellRef = React.useRef<HTMLDivElement | null>(null);
  const promptHighlightRef = React.useRef<HTMLDivElement | null>(null);
  const [showPromptTokenInlineError, setShowPromptTokenInlineError] = React.useState(false);
  const [promptVisualRowCount, setPromptVisualRowCount] = React.useState(1);

  const handlePromptTextChange = React.useCallback(
    (value: string) => {
      setShowPromptTokenInlineError(false);
      onPromptTextChange(value);
    },
    [onPromptTextChange]
  );

  const promptTokenAnalysis = React.useMemo(
    () =>
      analyzeExpertEditPromptTokens(promptTextValue, extraImageUrls, {
        allowSecondaryTokens: allowSecondaryReferenceTokens,
        maxSecondaryReferences: maxSecondaryReferenceTokens,
      }),
    [allowSecondaryReferenceTokens, extraImageUrls, maxSecondaryReferenceTokens, promptTextValue]
  );
  const availableSecondaryPromptTokenSlotIndexes = React.useMemo(
    () =>
      allowSecondaryReferenceTokens
        ? maxSecondaryReferenceTokens === 1 &&
          promptTokenAnalysis.referencedSlotIndexes.length === 1
          ? secondaries.filter(
              (index) =>
                promptTokenAnalysis.referencedSlotIndexes.includes(index) &&
                Boolean(extraImageUrls[index])
            )
          : secondaries.filter((index) => Boolean(extraImageUrls[index]))
        : [],
    [
      allowSecondaryReferenceTokens,
      extraImageUrls,
      maxSecondaryReferenceTokens,
      promptTokenAnalysis.referencedSlotIndexes,
    ]
  );
  const promptTokenPickerOptions = React.useMemo<PromptTokenPickerSelection[]>(
    () => [
      ...(populatedLayerCount > 0 ? (["main"] as PromptTokenPickerSelection[]) : []),
      ...availableSecondaryPromptTokenSlotIndexes,
    ],
    [availableSecondaryPromptTokenSlotIndexes, populatedLayerCount]
  );
  const promptHighlightSegments = React.useMemo(
    () => buildExpertEditPromptHighlightSegments(promptTextValue, promptTokenAnalysis.diagnostics),
    [promptTextValue, promptTokenAnalysis.diagnostics]
  );
  const promptTokenInlineError = showPromptTokenInlineError
    ? promptTokenAnalysis.inlineError
    : null;
  const populatedPromptTokenSlotIndexes = React.useMemo(
    () => availableSecondaryPromptTokenSlotIndexes,
    [availableSecondaryPromptTokenSlotIndexes]
  );

  const handleInvalidPromptReferenceToken = React.useCallback(
    (message: string) => {
      setShowPromptTokenInlineError(true);
      showStatusToast(message, "warning");
    },
    [showStatusToast]
  );

  const {
    closePromptTokenPicker,
    handlePromptDropWithTokenInsert,
    handlePromptKeyDown,
    insertPromptTokenFromPicker,
    promptTextareaRef,
    promptTokenPickerState,
  } = useExpertEditPromptTokenPickerRuntime({
    promptTextValue,
    promptTokenPickerOptions,
    allowSecondaryReferenceTokens,
    onPromptTextChange: handlePromptTextChange,
    showStatusToast,
  });

  const syncPromptHighlightScroll = React.useCallback(() => {
    syncTextareaMirrorScroll({
      textarea: promptTextareaRef.current,
      mirror: promptHighlightRef.current,
    });
  }, [promptTextareaRef]);

  const syncPromptTextareaHeight = React.useCallback(() => {
    const textarea = promptTextareaRef.current;
    setPromptVisualRowCount(resolveTextareaVisualRowCount(textarea));
    autoResizeTextareaWithinComputedBounds(textarea, 72, !isPromptComposerExpanded);
  }, [isPromptComposerExpanded, promptTextareaRef]);

  const handlePromptScroll = React.useCallback(() => {
    syncPromptHighlightScroll();
  }, [syncPromptHighlightScroll]);
  React.useEffect(() => {
    syncPromptTextareaHeight();
  }, [isPromptComposerExpanded, promptTextValue, syncPromptTextareaHeight]);

  React.useEffect(() => {
    const handleWindowResize = () => {
      syncPromptTextareaHeight();
      syncPromptHighlightScroll();
    };
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [syncPromptHighlightScroll, syncPromptTextareaHeight]);

  React.useEffect(() => {
    syncPromptHighlightScroll();
  }, [promptTextValue, syncPromptHighlightScroll]);

  React.useEffect(() => {
    if (!promptTokenAnalysis.inlineError && showPromptTokenInlineError) {
      setShowPromptTokenInlineError(false);
    }
  }, [promptTokenAnalysis.inlineError, showPromptTokenInlineError]);

  return {
    promptInputShellRef,
    promptHighlightRef,
    promptTextareaRef,
    promptVisualRowCount,
    promptHighlightSegments,
    promptTokenPickerState,
    promptTokenInlineError,
    populatedPromptTokenSlotIndexes,
    handlePromptTextChange,
    handleInvalidPromptReferenceToken,
    handlePromptKeyDown,
    handlePromptDropWithTokenInsert,
    handlePromptScroll,
    closePromptTokenPicker,
    insertPromptTokenFromPicker,
  };
}
