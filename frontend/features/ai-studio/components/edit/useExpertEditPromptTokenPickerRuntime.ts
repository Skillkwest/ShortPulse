import React from "react";

import { extractPromptDropText } from "../../utils/dragDrop";
import {
  resolveDroppedPromptTextEdit,
  resolveDroppedPromptTextEditMode,
} from "../promptStep/agentComposerDrop";
import {
  buildExpertEditPrimarySlotToken,
  buildExpertEditSecondarySlotToken,
  extractExpertEditPromptTokenFromTransfer,
  insertExpertEditPromptTokenAtSelection,
} from "../../logic/expertEditPromptReferences";
import { clampCaretPosition } from "./expertEditInteractionUtils";

export type PromptTokenPickerState = {
  isOpen: boolean;
  selectedSlotIndex: number | "main" | null;
  replaceStart: number;
  replaceEnd: number;
};

export type PromptTokenPickerSelection = number | "main";

type UseExpertEditPromptTokenPickerRuntimeArgs = {
  promptTextValue: string;
  promptTokenPickerOptions: PromptTokenPickerSelection[];
  allowSecondaryReferenceTokens: boolean;
  onPromptTextChange: (value: string) => void;
  showStatusToast: (message: string, tone?: "info" | "warning") => void;
};

export function useExpertEditPromptTokenPickerRuntime({
  promptTextValue,
  promptTokenPickerOptions,
  allowSecondaryReferenceTokens,
  onPromptTextChange,
  showStatusToast,
}: UseExpertEditPromptTokenPickerRuntimeArgs) {
  const promptTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const pendingPromptCaretRef = React.useRef<number | null>(null);
  const pendingPromptTokenPickerTriggerRef = React.useRef<{
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);
  const [promptTokenPickerState, setPromptTokenPickerState] =
    React.useState<PromptTokenPickerState>({
      isOpen: false,
      selectedSlotIndex: null,
      replaceStart: 0,
      replaceEnd: 0,
    });

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
      onPromptTextChange(insertedPrompt.prompt);
      setPromptTokenPickerState((previous) => ({
        ...previous,
        isOpen: false,
        selectedSlotIndex: null,
      }));
    },
    [
      onPromptTextChange,
      promptTextValue,
      promptTokenPickerState.replaceEnd,
      promptTokenPickerState.replaceStart,
      resolvePromptTokenPickerToken,
    ]
  );

  const handlePromptDrop = React.useCallback(
    (event: React.DragEvent<HTMLTextAreaElement>) => {
      event.preventDefault();
      const promptText = extractPromptDropText(event.dataTransfer);
      if (promptText) {
        const textarea = promptTextareaRef.current;
        const selectionStart = textarea?.selectionStart ?? promptTextValue.length;
        const selectionEnd = textarea?.selectionEnd ?? selectionStart;
        const nextPrompt = resolveDroppedPromptTextEdit({
          composerText: promptTextValue,
          droppedPromptText: promptText,
          selectionStart,
          selectionEnd,
          editMode: resolveDroppedPromptTextEditMode(event),
        });
        pendingPromptCaretRef.current = nextPrompt.caret;
        onPromptTextChange(nextPrompt.prompt);
      }
    },
    [onPromptTextChange, promptTextValue]
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
      onPromptTextChange(insertedPrompt.prompt);
    },
    [
      allowSecondaryReferenceTokens,
      closePromptTokenPicker,
      handlePromptDrop,
      onPromptTextChange,
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
    if (!promptTokenPickerState.isOpen) return;
    if (promptTokenPickerOptions.length <= 0) {
      closePromptTokenPicker();
      return;
    }
    if (
      promptTokenPickerState.selectedSlotIndex == null ||
      !promptTokenPickerOptions.includes(promptTokenPickerState.selectedSlotIndex)
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
    closePromptTokenPicker,
    handlePromptDropWithTokenInsert,
    handlePromptKeyDown,
    insertPromptTokenFromPicker,
    promptTextareaRef,
    promptTokenPickerState,
  };
}
