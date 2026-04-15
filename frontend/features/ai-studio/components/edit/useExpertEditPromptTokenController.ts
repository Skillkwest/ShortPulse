import React from "react";

import { extractDragDropPayload } from "../../utils/dragDrop";
import {
  analyzeExpertEditPromptTokens,
  buildExpertEditPrimarySlotToken,
  buildExpertEditPromptHighlightSegments,
  buildExpertEditSecondarySlotToken,
  extractExpertEditPromptTokenFromTransfer,
  insertExpertEditPromptTokenAtSelection,
} from "../../logic/expertEditPromptReferences";
import { secondaries } from "./expertEditPanelViewContract";
import {
  autoResizeTextareaWithinComputedBounds,
  clampCaretPosition,
  resolveTextareaVisualRowCount,
  syncTextareaMirrorScroll,
} from "./expertEditInteractionUtils";

type PromptTokenPickerState = {
  isOpen: boolean;
  selectedSlotIndex: (typeof secondaries)[number] | "main" | null;
  replaceStart: number;
  replaceEnd: number;
};

type PromptTokenPickerSelection = (typeof secondaries)[number] | "main";

type UseExpertEditPromptTokenControllerArgs = {
  promptTextValue: string;
  extraImageUrls: [string | null, string | null, string | null];
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
  const promptTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const promptInputShellRef = React.useRef<HTMLDivElement | null>(null);
  const promptHighlightRef = React.useRef<HTMLDivElement | null>(null);
  const pendingPromptCaretRef = React.useRef<number | null>(null);
  const pendingPromptTokenPickerTriggerRef = React.useRef<{
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);
  const [showPromptTokenInlineError, setShowPromptTokenInlineError] = React.useState(false);
  const [promptVisualRowCount, setPromptVisualRowCount] = React.useState(1);
  const [promptTokenPickerState, setPromptTokenPickerState] =
    React.useState<PromptTokenPickerState>({
      isOpen: false,
      selectedSlotIndex: null,
      replaceStart: 0,
      replaceEnd: 0,
    });

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

  const closePromptTokenPicker = React.useCallback(() => {
    pendingPromptTokenPickerTriggerRef.current = null;
    setPromptTokenPickerState((previous) =>
      previous.isOpen
        ? {
            ...previous,
            isOpen: false,
            selectedSlotIndex: null,
          }
        : previous
    );
  }, []);

  const resolvePromptTokenPickerToken = React.useCallback(
    (selection: PromptTokenPickerSelection | null) => {
      if (selection === "main") return buildExpertEditPrimarySlotToken();
      if (selection == null) return null;
      return buildExpertEditSecondarySlotToken(selection);
    },
    []
  );

  const cyclePromptTokenPickerSelection = React.useCallback(
    (direction: 1 | -1) => {
      if (promptTokenPickerOptions.length <= 0) return;
      setPromptTokenPickerState((previous) => {
        if (!previous.isOpen) return previous;
        const currentSelection: PromptTokenPickerSelection =
          previous.selectedSlotIndex ?? promptTokenPickerOptions[0] ?? "main";
        const currentIndex = promptTokenPickerOptions.indexOf(currentSelection);
        const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex =
          (safeCurrentIndex + direction + promptTokenPickerOptions.length) %
          promptTokenPickerOptions.length;
        return {
          ...previous,
          selectedSlotIndex: promptTokenPickerOptions[nextIndex] ?? null,
        };
      });
    },
    [promptTokenPickerOptions]
  );

  const insertPromptTokenFromPicker = React.useCallback(
    (selection: PromptTokenPickerSelection) => {
      const token = resolvePromptTokenPickerToken(selection);
      if (!token) return;
      const insertedPrompt = insertExpertEditPromptTokenAtSelection({
        prompt: promptTextValue,
        token,
        selectionStart: promptTokenPickerState.replaceStart,
        selectionEnd: promptTokenPickerState.replaceEnd,
      });
      pendingPromptCaretRef.current = insertedPrompt.caret;
      handlePromptTextChange(insertedPrompt.prompt);
      setPromptTokenPickerState((previous) => ({
        ...previous,
        isOpen: false,
        selectedSlotIndex: null,
      }));
    },
    [
      handlePromptTextChange,
      promptTextValue,
      promptTokenPickerState.replaceEnd,
      promptTokenPickerState.replaceStart,
      resolvePromptTokenPickerToken,
    ]
  );

  const syncPromptHighlightScroll = React.useCallback(() => {
    syncTextareaMirrorScroll({
      textarea: promptTextareaRef.current,
      mirror: promptHighlightRef.current,
    });
  }, []);

  const syncPromptTextareaHeight = React.useCallback(() => {
    const textarea = promptTextareaRef.current;
    setPromptVisualRowCount(resolveTextareaVisualRowCount(textarea));
    autoResizeTextareaWithinComputedBounds(textarea, 72, !isPromptComposerExpanded);
  }, [isPromptComposerExpanded]);

  const handlePromptScroll = React.useCallback(() => {
    syncPromptHighlightScroll();
  }, [syncPromptHighlightScroll]);

  const handlePromptDrop = React.useCallback(
    (event: React.DragEvent<HTMLTextAreaElement>) => {
      event.preventDefault();
      const { promptText } = extractDragDropPayload(event.dataTransfer);
      if (promptText) {
        handlePromptTextChange(promptText);
      }
    },
    [handlePromptTextChange]
  );

  const handlePromptDropWithTokenInsert = React.useCallback(
    (event: React.DragEvent<HTMLTextAreaElement>) => {
      event.preventDefault();
      const droppedToken = extractExpertEditPromptTokenFromTransfer(event.dataTransfer);
      if (!droppedToken) {
        handlePromptDrop(event);
        return;
      }
      if (!allowSecondaryReferenceTokens && droppedToken !== buildExpertEditPrimarySlotToken()) {
        closePromptTokenPicker();
        showStatusToast(
          "Inpaint only supports @main. Secondary references are not sent to the inpaint model.",
          "warning"
        );
        return;
      }
      const textarea = promptTextareaRef.current;
      const selectionStart = textarea?.selectionStart ?? promptTextValue.length;
      const selectionEnd = textarea?.selectionEnd ?? selectionStart;
      const insertedPrompt = insertExpertEditPromptTokenAtSelection({
        prompt: promptTextValue,
        token: droppedToken,
        selectionStart,
        selectionEnd,
      });
      pendingPromptCaretRef.current = insertedPrompt.caret;
      closePromptTokenPicker();
      handlePromptTextChange(insertedPrompt.prompt);
    },
    [
      allowSecondaryReferenceTokens,
      closePromptTokenPicker,
      handlePromptDrop,
      handlePromptTextChange,
      promptTextValue,
      showStatusToast,
    ]
  );

  const openPromptTokenPickerAtSelection = React.useCallback(
    (selectionStart: number, selectionEnd: number) => {
      if (promptTokenPickerOptions.length <= 0) return;
      const normalizedSelectionStart = clampCaretPosition({
        caretPosition: selectionStart,
        textLength: promptTextValue.length,
      });
      const normalizedSelectionEnd = clampCaretPosition({
        caretPosition: selectionEnd,
        textLength: promptTextValue.length,
      });
      setPromptTokenPickerState({
        isOpen: true,
        selectedSlotIndex: promptTokenPickerOptions[0] ?? null,
        replaceStart: Math.min(normalizedSelectionStart, normalizedSelectionEnd),
        replaceEnd: Math.max(normalizedSelectionStart, normalizedSelectionEnd),
      });
    },
    [promptTokenPickerOptions, promptTextValue.length]
  );

  const handlePromptKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (promptTokenPickerState.isOpen) {
        if (event.key === "Tab") {
          event.preventDefault();
          cyclePromptTokenPickerSelection(event.shiftKey ? -1 : 1);
          return;
        }
        if (event.key === "Enter") {
          if (promptTokenPickerState.selectedSlotIndex != null) {
            event.preventDefault();
            insertPromptTokenFromPicker(promptTokenPickerState.selectedSlotIndex);
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closePromptTokenPicker();
          return;
        }
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          cyclePromptTokenPickerSelection(1);
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          cyclePromptTokenPickerSelection(-1);
          return;
        }
        if (
          event.key === "Backspace" ||
          event.key === "Delete" ||
          (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey)
        ) {
          closePromptTokenPicker();
        }
      }

      if (
        event.key === "Tab" &&
        !event.defaultPrevented &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        promptTokenPickerOptions.length > 0
      ) {
        event.preventDefault();
        const selectionStart = event.currentTarget.selectionStart ?? promptTextValue.length;
        const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
        openPromptTokenPickerAtSelection(selectionStart, selectionEnd);
        return;
      }

      if (
        event.key === "@" &&
        !event.defaultPrevented &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        promptTokenPickerOptions.length > 0
      ) {
        pendingPromptTokenPickerTriggerRef.current = {
          selectionStart: event.currentTarget.selectionStart ?? promptTextValue.length,
          selectionEnd: event.currentTarget.selectionEnd ?? promptTextValue.length,
        };
      }
    },
    [
      closePromptTokenPicker,
      cyclePromptTokenPickerSelection,
      insertPromptTokenFromPicker,
      openPromptTokenPickerAtSelection,
      promptTokenPickerOptions.length,
      promptTextValue.length,
      promptTokenPickerState.isOpen,
      promptTokenPickerState.selectedSlotIndex,
    ]
  );

  React.useEffect(() => {
    const caretPosition = pendingPromptCaretRef.current;
    if (caretPosition == null) return;
    const textarea = promptTextareaRef.current;
    if (!textarea) return;
    const maxCaret = clampCaretPosition({
      caretPosition,
      textLength: promptTextValue.length,
    });
    textarea.focus();
    textarea.setSelectionRange(maxCaret, maxCaret);
    pendingPromptCaretRef.current = null;
  }, [promptTextValue]);

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
    const pendingTrigger = pendingPromptTokenPickerTriggerRef.current;
    if (!pendingTrigger) return;
    pendingPromptTokenPickerTriggerRef.current = null;
    if (promptTokenPickerOptions.length <= 0) return;
    const replaceStart = clampCaretPosition({
      caretPosition: pendingTrigger.selectionStart,
      textLength: promptTextValue.length,
    });
    const replaceEnd = Math.min(promptTextValue.length, replaceStart + 1);
    if (promptTextValue.slice(replaceStart, replaceEnd) !== "@") return;
    setPromptTokenPickerState({
      isOpen: true,
      selectedSlotIndex: promptTokenPickerOptions[0] ?? null,
      replaceStart,
      replaceEnd,
    });
  }, [promptTokenPickerOptions, promptTextValue]);

  React.useEffect(() => {
    if (!promptTokenAnalysis.inlineError && showPromptTokenInlineError) {
      setShowPromptTokenInlineError(false);
    }
  }, [promptTokenAnalysis.inlineError, showPromptTokenInlineError]);

  React.useEffect(() => {
    if (!promptTokenPickerState.isOpen) return;
    if (promptTokenPickerOptions.length <= 0) {
      closePromptTokenPicker();
      return;
    }
    if (
      promptTokenPickerState.selectedSlotIndex == null ||
      !promptTokenPickerOptions.includes(
        promptTokenPickerState.selectedSlotIndex as PromptTokenPickerSelection
      )
    ) {
      setPromptTokenPickerState((previous) => ({
        ...previous,
        selectedSlotIndex: promptTokenPickerOptions[0] ?? null,
      }));
    }
  }, [
    closePromptTokenPicker,
    promptTokenPickerOptions,
    promptTokenPickerState.isOpen,
    promptTokenPickerState.selectedSlotIndex,
  ]);

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
