/**
 * Owns Video prompt token insertion, picker state, caret restore, and text-drop behavior.
 */
import React from "react";
import { extractPromptDropText } from "../../utils/dragDrop";
import {
  insertDroppedPromptTextAtSelection,
  resolveDroppedPromptTextEdit,
  resolveDroppedPromptTextEditMode,
} from "../promptStep/agentComposerDrop";
import {
  isPromptTokenEligibleKlingElement,
  resolveAiStudioKlingElementLegacyTokens,
  resolveAiStudioKlingElementTokens,
  resolveKieKlingElementTokens,
  type AiStudioKlingElement,
} from "../../logic/klingElements";
import {
  analyzeKlingPromptTokens,
  buildKlingElementPromptToken,
  buildKlingPromptHighlightSegments,
  extractKlingElementPromptTokenFromTransfer,
} from "../../logic/klingPromptReferences";
import { insertPromptTokenAtSelection } from "../../logic/promptTokenInsertion";
import type { CanvasTearOutComposerTargetRegistry } from "../../hooks/useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";
import { VideoPromptTokenPicker } from "./VideoPromptTokenPicker";

export type VideoPromptTarget = "primary" | string;

type VideoPromptTokenShot = {
  id: string;
  prompt: string;
};

type UseVideoPromptTokenControllerArgs = {
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  customKlingPrompts: VideoPromptTokenShot[];
  customPromptTextareaRefs: React.MutableRefObject<Record<string, HTMLTextAreaElement | null>>;
  onCustomPromptChange: (shotId: string, value: string) => void;
  onPrimaryPromptChange: (value: string) => void;
  primaryPromptShellRef: React.MutableRefObject<HTMLDivElement | null>;
  primaryPromptTextareaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  primaryPromptValue: string;
  selectedKlingElements: Array<AiStudioKlingElement | null>;
};

/**
 * Returns prompt-token state and handlers for Video prompt textareas.
 */
export function useVideoPromptTokenController({
  canvasTearOutTargetRegistry,
  customKlingPrompts,
  customPromptTextareaRefs,
  onCustomPromptChange,
  onPrimaryPromptChange,
  primaryPromptShellRef,
  primaryPromptTextareaRef,
  primaryPromptValue,
  selectedKlingElements,
}: UseVideoPromptTokenControllerArgs) {
  const pendingPromptCaretRef = React.useRef<{ target: VideoPromptTarget; caret: number } | null>(
    null
  );
  const activePromptTargetRef = React.useRef<VideoPromptTarget>("primary");
  const pendingPromptTokenPickerTriggerRef = React.useRef<{
    target: VideoPromptTarget;
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);
  const [promptTokenPickerState, setPromptTokenPickerState] = React.useState<{
    isOpen: boolean;
    selectedSlotIndex: number | null;
    replaceStart: number;
    replaceEnd: number;
    target: VideoPromptTarget;
  }>({
    isOpen: false,
    selectedSlotIndex: null,
    replaceStart: 0,
    replaceEnd: 0,
    target: "primary",
  });
  const [isPromptCanvasTearOutActive, setIsPromptCanvasTearOutActive] = React.useState(false);

  const klingElementDisplayTokens = React.useMemo(
    () => resolveAiStudioKlingElementTokens(selectedKlingElements).map((token) => token.trim()),
    [selectedKlingElements]
  );
  const klingElementCanonicalPromptTokens = React.useMemo(
    () => resolveKieKlingElementTokens(selectedKlingElements).map((token) => token.trim()),
    [selectedKlingElements]
  );
  const populatedKlingPromptTokenSlotIndexes = React.useMemo(
    () =>
      selectedKlingElements.flatMap((element, index) => {
        if (!isPromptTokenEligibleKlingElement(element)) return [];
        const token = klingElementCanonicalPromptTokens[index] ?? "";
        return token ? [index] : [];
      }),
    [klingElementCanonicalPromptTokens, selectedKlingElements]
  );
  const klingPromptAttachedSlots = React.useMemo(
    () =>
      populatedKlingPromptTokenSlotIndexes.map((slotIndex) => {
        const selectedElement = selectedKlingElements[slotIndex];
        return {
          token: klingElementCanonicalPromptTokens[slotIndex] ?? "",
          legacyAliases: selectedElement
            ? resolveAiStudioKlingElementLegacyTokens(
                selectedElement,
                slotIndex,
                selectedKlingElements
              )
            : [],
          sourceKind: selectedElement?.sourceKind ?? null,
        };
      }),
    [klingElementCanonicalPromptTokens, populatedKlingPromptTokenSlotIndexes, selectedKlingElements]
  );
  const primaryPromptTokenDiagnostics = React.useMemo(
    () => analyzeKlingPromptTokens(primaryPromptValue, klingPromptAttachedSlots),
    [klingPromptAttachedSlots, primaryPromptValue]
  );
  const primaryPromptHighlightSegments = React.useMemo(
    () => buildKlingPromptHighlightSegments(primaryPromptValue, primaryPromptTokenDiagnostics),
    [primaryPromptTokenDiagnostics, primaryPromptValue]
  );
  const resolvePromptHighlightSegments = React.useCallback(
    (prompt: string) =>
      buildKlingPromptHighlightSegments(
        prompt,
        analyzeKlingPromptTokens(prompt, klingPromptAttachedSlots)
      ),
    [klingPromptAttachedSlots]
  );
  const getPromptValueForTarget = React.useCallback(
    (target: VideoPromptTarget): string => {
      if (target === "primary") return primaryPromptValue;
      return customKlingPrompts.find((shot) => shot.id === target)?.prompt ?? "";
    },
    [customKlingPrompts, primaryPromptValue]
  );
  const getPromptTextareaForTarget = React.useCallback(
    (target: VideoPromptTarget) => {
      if (target === "primary") return primaryPromptTextareaRef.current;
      return customPromptTextareaRefs.current[target] ?? null;
    },
    [customPromptTextareaRefs, primaryPromptTextareaRef]
  );
  const setActivePromptTarget = React.useCallback((target: VideoPromptTarget) => {
    activePromptTargetRef.current = target;
  }, []);
  const applyPromptUpdateForTarget = React.useCallback(
    (target: VideoPromptTarget, nextPrompt: string, caret?: number | null) => {
      if (typeof caret === "number") {
        pendingPromptCaretRef.current = {
          target,
          caret,
        };
      }
      if (target === "primary") {
        onPrimaryPromptChange(nextPrompt);
        return;
      }
      onCustomPromptChange(target, nextPrompt);
    },
    [onCustomPromptChange, onPrimaryPromptChange]
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
    (slotIndex: number | null) => {
      if (slotIndex == null) return null;
      const element = selectedKlingElements[slotIndex];
      if (!element) return null;
      return buildKlingElementPromptToken(klingElementCanonicalPromptTokens[slotIndex] ?? "");
    },
    [klingElementCanonicalPromptTokens, selectedKlingElements]
  );
  const resolvePromptTokenPickerDisplayToken = React.useCallback(
    (slotIndex: number | null) => {
      if (slotIndex == null) return null;
      const element = selectedKlingElements[slotIndex];
      if (!element) return null;
      return buildKlingElementPromptToken(klingElementDisplayTokens[slotIndex] ?? "");
    },
    [klingElementDisplayTokens, selectedKlingElements]
  );
  const cyclePromptTokenPickerSelection = React.useCallback(
    (direction: 1 | -1) => {
      if (populatedKlingPromptTokenSlotIndexes.length <= 0) return;
      setPromptTokenPickerState((previous) => {
        if (!previous.isOpen) return previous;
        const currentSelection =
          previous.selectedSlotIndex ?? populatedKlingPromptTokenSlotIndexes[0] ?? null;
        const currentIndex = populatedKlingPromptTokenSlotIndexes.indexOf(currentSelection ?? -1);
        const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex =
          (safeCurrentIndex + direction + populatedKlingPromptTokenSlotIndexes.length) %
          populatedKlingPromptTokenSlotIndexes.length;
        return {
          ...previous,
          selectedSlotIndex: populatedKlingPromptTokenSlotIndexes[nextIndex] ?? null,
        };
      });
    },
    [populatedKlingPromptTokenSlotIndexes]
  );
  const openPromptTokenPickerAtSelection = React.useCallback(
    (target: VideoPromptTarget, selectionStart: number, selectionEnd: number) => {
      if (populatedKlingPromptTokenSlotIndexes.length <= 0) return;
      const promptValue = getPromptValueForTarget(target);
      const normalizedSelectionStart = Math.max(0, Math.min(promptValue.length, selectionStart));
      const normalizedSelectionEnd = Math.max(0, Math.min(promptValue.length, selectionEnd));
      setPromptTokenPickerState({
        isOpen: true,
        selectedSlotIndex: populatedKlingPromptTokenSlotIndexes[0] ?? null,
        replaceStart: Math.min(normalizedSelectionStart, normalizedSelectionEnd),
        replaceEnd: Math.max(normalizedSelectionStart, normalizedSelectionEnd),
        target,
      });
    },
    [getPromptValueForTarget, populatedKlingPromptTokenSlotIndexes]
  );
  const insertKlingElementToken = React.useCallback(
    (token: string) => {
      const target = activePromptTargetRef.current;
      const promptValue = getPromptValueForTarget(target);
      const textarea = getPromptTextareaForTarget(target);
      const selectionStart = textarea?.selectionStart ?? promptValue.length;
      const selectionEnd = textarea?.selectionEnd ?? selectionStart;
      const normalizedToken = buildKlingElementPromptToken(token);
      if (!normalizedToken) return;
      const insertedPrompt = insertPromptTokenAtSelection({
        prompt: promptValue,
        token: normalizedToken,
        selectionStart,
        selectionEnd,
      });
      closePromptTokenPicker();
      applyPromptUpdateForTarget(target, insertedPrompt.prompt, insertedPrompt.caret);
    },
    [
      applyPromptUpdateForTarget,
      closePromptTokenPicker,
      getPromptTextareaForTarget,
      getPromptValueForTarget,
    ]
  );
  const insertPromptTokenFromPicker = React.useCallback(
    (slotIndex: number) => {
      const token = resolvePromptTokenPickerToken(slotIndex);
      if (!token) return;
      const promptValue = getPromptValueForTarget(promptTokenPickerState.target);
      const insertedPrompt = insertPromptTokenAtSelection({
        prompt: promptValue,
        token,
        selectionStart: promptTokenPickerState.replaceStart,
        selectionEnd: promptTokenPickerState.replaceEnd,
      });
      applyPromptUpdateForTarget(
        promptTokenPickerState.target,
        insertedPrompt.prompt,
        insertedPrompt.caret
      );
      setPromptTokenPickerState((previous) => ({
        ...previous,
        isOpen: false,
        selectedSlotIndex: null,
      }));
    },
    [
      applyPromptUpdateForTarget,
      getPromptValueForTarget,
      promptTokenPickerState.replaceEnd,
      promptTokenPickerState.replaceStart,
      promptTokenPickerState.target,
      resolvePromptTokenPickerToken,
    ]
  );
  const handlePromptDropWithKlingTokenInsert = React.useCallback(
    (
      event: React.DragEvent<HTMLDivElement | HTMLTextAreaElement>,
      options?: { shotId?: string; promptValue?: string }
    ) => {
      const target: VideoPromptTarget = options?.shotId ?? "primary";
      setActivePromptTarget(target);
      const droppedToken = extractKlingElementPromptTokenFromTransfer(event.dataTransfer);
      const promptValue = options?.promptValue ?? primaryPromptValue;
      const targetTextarea =
        event.target instanceof HTMLTextAreaElement
          ? event.target
          : options?.shotId
            ? customPromptTextareaRefs.current[options.shotId]
            : primaryPromptTextareaRef.current;
      if (!droppedToken) {
        event.preventDefault();
        const promptText = extractPromptDropText(event.dataTransfer);
        if (!promptText) return;
        closePromptTokenPicker();
        const selectionStart = targetTextarea?.selectionStart ?? promptValue.length;
        const selectionEnd = targetTextarea?.selectionEnd ?? selectionStart;
        const nextPrompt = resolveDroppedPromptTextEdit({
          composerText: promptValue,
          droppedPromptText: promptText,
          selectionStart,
          selectionEnd,
          editMode: resolveDroppedPromptTextEditMode(event),
        });
        applyPromptUpdateForTarget(target, nextPrompt.prompt, nextPrompt.caret);
        return;
      }
      event.preventDefault();
      const selectionStart = targetTextarea?.selectionStart ?? promptValue.length;
      const selectionEnd = targetTextarea?.selectionEnd ?? selectionStart;
      const insertedPrompt = insertPromptTokenAtSelection({
        prompt: promptValue,
        token: droppedToken,
        selectionStart,
        selectionEnd,
      });
      closePromptTokenPicker();
      applyPromptUpdateForTarget(target, insertedPrompt.prompt, insertedPrompt.caret);
    },
    [
      applyPromptUpdateForTarget,
      closePromptTokenPicker,
      customPromptTextareaRefs,
      primaryPromptTextareaRef,
      primaryPromptValue,
      setActivePromptTarget,
    ]
  );
  const canAcceptPromptCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) =>
      payload.kind === "text" && payload.text.trim().length > 0,
    []
  );
  const acceptPromptCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => {
      if (payload.kind !== "text") return;
      const droppedText = payload.text.trim();
      if (!droppedText) return;
      const textarea = primaryPromptTextareaRef.current;
      const shouldUseTextareaSelection =
        typeof document !== "undefined" && textarea ? document.activeElement === textarea : false;
      const selectionStart = shouldUseTextareaSelection
        ? (textarea?.selectionStart ?? primaryPromptValue.length)
        : primaryPromptValue.length;
      const selectionEnd = shouldUseTextareaSelection
        ? (textarea?.selectionEnd ?? primaryPromptValue.length)
        : primaryPromptValue.length;
      const insertedPrompt = insertDroppedPromptTextAtSelection({
        composerText: primaryPromptValue,
        droppedPromptText: droppedText,
        selectionStart,
        selectionEnd,
      });
      closePromptTokenPicker();
      applyPromptUpdateForTarget("primary", insertedPrompt.prompt, insertedPrompt.caret);
      const restoreCaret = () => {
        const activeTextarea = primaryPromptTextareaRef.current;
        activeTextarea?.focus();
        activeTextarea?.setSelectionRange(insertedPrompt.caret, insertedPrompt.caret);
      };
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(restoreCaret);
      } else {
        restoreCaret();
      }
    },
    [
      applyPromptUpdateForTarget,
      closePromptTokenPicker,
      primaryPromptTextareaRef,
      primaryPromptValue,
    ]
  );

  React.useEffect(() => {
    if (!canvasTearOutTargetRegistry || !primaryPromptShellRef.current) return;
    return canvasTearOutTargetRegistry.registerTarget({
      id: "video-primary-prompt-composer",
      element: primaryPromptShellRef.current,
      canAccept: canAcceptPromptCanvasTearOutPayload,
      accept: acceptPromptCanvasTearOutPayload,
      setActive: setIsPromptCanvasTearOutActive,
    });
  }, [
    acceptPromptCanvasTearOutPayload,
    canAcceptPromptCanvasTearOutPayload,
    canvasTearOutTargetRegistry,
    primaryPromptShellRef,
  ]);
  const handlePromptSelection = React.useCallback(
    (target: VideoPromptTarget) => {
      setActivePromptTarget(target);
    },
    [setActivePromptTarget]
  );
  const handlePromptBlur = React.useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      const relatedTarget = event.relatedTarget as HTMLElement | null;
      if (relatedTarget?.closest(".video-kling-prompt-token-picker")) {
        return;
      }
      closePromptTokenPicker();
    },
    [closePromptTokenPicker]
  );
  const handlePromptKeyDown = React.useCallback(
    (
      event: React.KeyboardEvent<HTMLTextAreaElement>,
      options?: { shotId?: string; promptValue?: string }
    ) => {
      const target: VideoPromptTarget = options?.shotId ?? "primary";
      setActivePromptTarget(target);
      const promptValue = options?.promptValue ?? event.currentTarget.value;
      if (promptTokenPickerState.isOpen && promptTokenPickerState.target === target) {
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
        populatedKlingPromptTokenSlotIndexes.length > 0
      ) {
        event.preventDefault();
        const selectionStart = event.currentTarget.selectionStart ?? promptValue.length;
        const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
        openPromptTokenPickerAtSelection(target, selectionStart, selectionEnd);
        return;
      }

      if (
        event.key === "@" &&
        !event.defaultPrevented &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        populatedKlingPromptTokenSlotIndexes.length > 0
      ) {
        pendingPromptTokenPickerTriggerRef.current = {
          target,
          selectionStart: event.currentTarget.selectionStart ?? promptValue.length,
          selectionEnd: event.currentTarget.selectionEnd ?? promptValue.length,
        };
      }
    },
    [
      closePromptTokenPicker,
      cyclePromptTokenPickerSelection,
      insertPromptTokenFromPicker,
      openPromptTokenPickerAtSelection,
      populatedKlingPromptTokenSlotIndexes.length,
      promptTokenPickerState.isOpen,
      promptTokenPickerState.selectedSlotIndex,
      promptTokenPickerState.target,
      setActivePromptTarget,
    ]
  );

  React.useEffect(() => {
    const pendingCaret = pendingPromptCaretRef.current;
    if (!pendingCaret) return;
    const textarea =
      pendingCaret.target === "primary"
        ? primaryPromptTextareaRef.current
        : customPromptTextareaRefs.current[pendingCaret.target];
    if (!textarea) return;
    const maxCaret = Math.max(0, Math.min(textarea.value.length, pendingCaret.caret));
    textarea.focus();
    textarea.setSelectionRange(maxCaret, maxCaret);
    pendingPromptCaretRef.current = null;
  }, [customKlingPrompts, customPromptTextareaRefs, primaryPromptTextareaRef, primaryPromptValue]);

  React.useEffect(() => {
    const pendingTrigger = pendingPromptTokenPickerTriggerRef.current;
    if (!pendingTrigger) return;
    pendingPromptTokenPickerTriggerRef.current = null;
    if (populatedKlingPromptTokenSlotIndexes.length <= 0) return;
    const promptValue = getPromptValueForTarget(pendingTrigger.target);
    const replaceStart = Math.max(0, Math.min(promptValue.length, pendingTrigger.selectionStart));
    const replaceEnd = Math.min(promptValue.length, replaceStart + 1);
    if (promptValue.slice(replaceStart, replaceEnd) !== "@") return;
    setPromptTokenPickerState({
      isOpen: true,
      selectedSlotIndex: populatedKlingPromptTokenSlotIndexes[0] ?? null,
      replaceStart,
      replaceEnd,
      target: pendingTrigger.target,
    });
  }, [
    customKlingPrompts,
    getPromptValueForTarget,
    populatedKlingPromptTokenSlotIndexes,
    primaryPromptValue,
  ]);

  React.useEffect(() => {
    if (!promptTokenPickerState.isOpen) return;
    if (populatedKlingPromptTokenSlotIndexes.length <= 0) {
      closePromptTokenPicker();
      return;
    }
    if (
      promptTokenPickerState.selectedSlotIndex == null ||
      !populatedKlingPromptTokenSlotIndexes.includes(promptTokenPickerState.selectedSlotIndex)
    ) {
      setPromptTokenPickerState((previous) => ({
        ...previous,
        selectedSlotIndex: populatedKlingPromptTokenSlotIndexes[0] ?? null,
      }));
    }
  }, [
    closePromptTokenPicker,
    populatedKlingPromptTokenSlotIndexes,
    promptTokenPickerState.isOpen,
    promptTokenPickerState.selectedSlotIndex,
  ]);

  const renderPromptTokenPicker = React.useCallback(
    (target: VideoPromptTarget) => {
      if (!promptTokenPickerState.isOpen || promptTokenPickerState.target !== target) {
        return null;
      }

      return (
        <VideoPromptTokenPicker
          slotIndexes={populatedKlingPromptTokenSlotIndexes}
          selectedSlotIndex={promptTokenPickerState.selectedSlotIndex}
          elements={selectedKlingElements}
          resolveDisplayToken={resolvePromptTokenPickerDisplayToken}
          onInsertToken={insertPromptTokenFromPicker}
        />
      );
    },
    [
      insertPromptTokenFromPicker,
      populatedKlingPromptTokenSlotIndexes,
      promptTokenPickerState.isOpen,
      promptTokenPickerState.selectedSlotIndex,
      promptTokenPickerState.target,
      resolvePromptTokenPickerDisplayToken,
      selectedKlingElements,
    ]
  );

  return {
    activePromptTargetRef,
    handlePromptBlur,
    handlePromptDropWithKlingTokenInsert,
    handlePromptKeyDown,
    handlePromptSelection,
    insertKlingElementToken,
    isPromptCanvasTearOutActive,
    klingElementCanonicalPromptTokens,
    primaryPromptHighlightSegments,
    renderPromptTokenPicker,
    resolvePromptHighlightSegments,
  };
}
