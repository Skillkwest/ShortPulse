/**
 * Registers Expert Edit canvas tear-out targets for the primary stage and prompt composer.
 */
import React from "react";

import type { CanvasTearOutComposerTargetRegistry } from "../../hooks/useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";
import { resolveDroppedPromptTextEdit } from "../promptStep/agentComposerDrop";

type UseExpertEditCanvasTearOutRuntimeArgs = {
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  primaryCanvasFrameStackElement: HTMLDivElement | null;
  acceptPrimaryCanvasTearOutPayload: (payload: AgentComposerDirectDropPayload) => void;
  promptInputShellRef: React.RefObject<HTMLDivElement | null>;
  promptTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  promptTextValue: string;
  handlePromptTextChange: (nextValue: string) => void;
};

export function useExpertEditCanvasTearOutRuntime({
  canvasTearOutTargetRegistry,
  primaryCanvasFrameStackElement,
  acceptPrimaryCanvasTearOutPayload,
  promptInputShellRef,
  promptTextareaRef,
  promptTextValue,
  handlePromptTextChange,
}: UseExpertEditCanvasTearOutRuntimeArgs) {
  const [isPrimaryCanvasTearOutActive, setIsPrimaryCanvasTearOutActive] = React.useState(false);
  const [isPromptCanvasTearOutActive, setIsPromptCanvasTearOutActive] = React.useState(false);

  const canAcceptEditCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => payload.kind === "image",
    []
  );
  const canAcceptEditPromptCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) =>
      payload.kind === "text" && payload.text.trim().length > 0,
    []
  );

  const acceptPromptCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => {
      if (payload.kind !== "text") return;
      const droppedText = payload.text.trim();
      if (!droppedText) return;
      const textarea = promptTextareaRef.current;
      const shouldUseTextareaSelection =
        typeof document !== "undefined" && textarea ? document.activeElement === textarea : false;
      const selectionStart = shouldUseTextareaSelection
        ? (textarea?.selectionStart ?? promptTextValue.length)
        : promptTextValue.length;
      const selectionEnd = shouldUseTextareaSelection
        ? (textarea?.selectionEnd ?? promptTextValue.length)
        : promptTextValue.length;
      const inserted = resolveDroppedPromptTextEdit({
        composerText: promptTextValue,
        droppedPromptText: droppedText,
        editMode: "replace",
        selectionStart,
        selectionEnd,
      });
      handlePromptTextChange(inserted.prompt);
      const restoreCaret = () => {
        const activeTextarea = promptTextareaRef.current;
        activeTextarea?.focus();
        activeTextarea?.setSelectionRange(inserted.caret, inserted.caret);
      };
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(restoreCaret);
      } else {
        restoreCaret();
      }
    },
    [handlePromptTextChange, promptTextareaRef, promptTextValue]
  );

  React.useEffect(() => {
    if (!canvasTearOutTargetRegistry || !primaryCanvasFrameStackElement) return;
    return canvasTearOutTargetRegistry.registerTarget({
      id: "expert-edit-primary-stage",
      element: primaryCanvasFrameStackElement,
      canAccept: canAcceptEditCanvasTearOutPayload,
      accept: acceptPrimaryCanvasTearOutPayload,
      setActive: setIsPrimaryCanvasTearOutActive,
    });
  }, [
    acceptPrimaryCanvasTearOutPayload,
    canAcceptEditCanvasTearOutPayload,
    canvasTearOutTargetRegistry,
    primaryCanvasFrameStackElement,
  ]);

  React.useEffect(() => {
    if (!canvasTearOutTargetRegistry || !promptInputShellRef.current) return;
    return canvasTearOutTargetRegistry.registerTarget({
      id: "expert-edit-prompt-composer",
      element: promptInputShellRef.current,
      canAccept: canAcceptEditPromptCanvasTearOutPayload,
      accept: acceptPromptCanvasTearOutPayload,
      setActive: setIsPromptCanvasTearOutActive,
    });
  }, [
    acceptPromptCanvasTearOutPayload,
    canAcceptEditPromptCanvasTearOutPayload,
    canvasTearOutTargetRegistry,
    promptInputShellRef,
  ]);

  return {
    isPrimaryCanvasTearOutActive,
    isPromptCanvasTearOutActive,
  };
}
