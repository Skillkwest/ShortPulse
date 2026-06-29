/**
 * Shared prompt-text drop helpers for AI Studio textarea composers.
 * Keeps text-reference drops consistent across standard, video, and sound surfaces.
 */
import type React from "react";
import {
  insertDroppedPromptTextAtSelection,
  resolveAgentComposerTextDropInsertion,
  resolveDroppedPromptTextEditMode,
} from "../promptStep/agentComposerDrop";
import { extractPromptDropText, getNormalizedTransferTypes } from "../../utils/dragDrop";

const PROMPT_TEXT_TRANSFER_HINTS = new Set([
  "application/x-shortpulse-prompt-reference-drag-token",
  "text/shortpulse-prompt-reference-drag-token",
  "text/prompt",
  "text",
  "text/plain",
]);

const MEDIA_TRANSFER_HINTS = new Set([
  "files",
  "image/url",
  "text/reference-url",
  "text/reference-render-url",
  "text/reference-composer-image-drop-token",
  "text/reference-composer-image-payload",
  "application/x-shortpulse-composer-image-drop-token",
  "application/x-shortpulse-composer-image-drop",
]);

type ApplyPromptTextEditOptions = {
  composerText: string;
  droppedPromptText: string;
  onChange: (value: string) => void;
  selectionStart: number;
  selectionEnd: number;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  editMode?: "replace" | "insert";
};

type PromptTextAreaDropOptions = {
  event: React.DragEvent<HTMLTextAreaElement>;
  composerText: string;
  onChange: (value: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
};

type CanvasPromptTextDropOptions = {
  composerText: string;
  droppedPromptText: string;
  onChange: (value: string) => void;
  textarea: HTMLTextAreaElement | null;
};

const restoreTextareaCaret = (
  textarea: HTMLTextAreaElement | null | undefined,
  caret: number
): void => {
  requestAnimationFrame(() => {
    textarea?.focus();
    textarea?.setSelectionRange(caret, caret);
  });
};

export const canAcceptPromptTextDrop = (transfer: DataTransfer): boolean => {
  if (extractPromptDropText(transfer)) return true;

  const transferTypes = getNormalizedTransferTypes(transfer);
  if (transferTypes.some((type) => MEDIA_TRANSFER_HINTS.has(type))) return false;
  return transferTypes.some((type) => PROMPT_TEXT_TRANSFER_HINTS.has(type));
};

export const applyPromptTextEdit = ({
  composerText,
  droppedPromptText,
  editMode = "insert",
  onChange,
  selectionEnd,
  selectionStart,
  textareaRef,
}: ApplyPromptTextEditOptions): boolean => {
  const normalizedDropText = droppedPromptText.trim();
  if (!normalizedDropText) return false;

  const nextPrompt =
    editMode === "replace"
      ? {
          prompt: normalizedDropText,
          caret: normalizedDropText.length,
        }
      : insertDroppedPromptTextAtSelection({
          composerText,
          droppedPromptText: normalizedDropText,
          selectionStart,
          selectionEnd,
        });
  onChange(nextPrompt.prompt);
  restoreTextareaCaret(textareaRef?.current, nextPrompt.caret);
  return true;
};

export const handlePromptTextAreaDragOver = (event: React.DragEvent<HTMLTextAreaElement>): void => {
  if (!canAcceptPromptTextDrop(event.dataTransfer)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
};

export const handlePromptTextAreaDrop = ({
  event,
  composerText,
  onChange,
  textareaRef,
}: PromptTextAreaDropOptions): boolean => {
  const textarea = event.currentTarget;
  const insertedPrompt = resolveAgentComposerTextDropInsertion({
    transfer: event.dataTransfer,
    composerText,
    selectionStart: textarea.selectionStart ?? composerText.length,
    selectionEnd: textarea.selectionEnd ?? textarea.selectionStart ?? composerText.length,
    editMode: resolveDroppedPromptTextEditMode(event),
  });
  if (!insertedPrompt) return false;

  event.preventDefault();
  event.stopPropagation();
  onChange(insertedPrompt.prompt);
  restoreTextareaCaret(textareaRef?.current ?? textarea, insertedPrompt.caret);
  return true;
};

export const insertCanvasPromptTextIntoTextarea = ({
  composerText,
  droppedPromptText,
  onChange,
  textarea,
}: CanvasPromptTextDropOptions): boolean => {
  const shouldUseTextareaSelection =
    typeof document !== "undefined" && textarea ? document.activeElement === textarea : false;
  return applyPromptTextEdit({
    composerText,
    droppedPromptText,
    onChange,
    selectionStart: shouldUseTextareaSelection
      ? (textarea?.selectionStart ?? composerText.length)
      : composerText.length,
    selectionEnd: shouldUseTextareaSelection
      ? (textarea?.selectionEnd ?? composerText.length)
      : composerText.length,
    textareaRef: { current: textarea },
  });
};
