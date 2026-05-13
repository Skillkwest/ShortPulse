/**
 * Lightweight chat panel to replace prompt textareas.
 * UI stays minimal so existing panel styles remain dominant.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentSendButton } from "../buttons/AgentSendButton";
import { AgentResponseInlineGenerateButton } from "../buttons/AgentResponseInlineGenerateButton";
import { AgentInputBar } from "../inputs/AgentInputBar";
import { AgentImageAttachmentPreview } from "../components/AgentImageAttachmentPreview";
import { projectAgentAttachmentToComposerImageAttachment } from "../../../features/ai-studio/logic/composerImageAttachment";
import {
  captureAssistantInlineEditPresentation,
  resolveAssistantInlineEditStyle,
  type AssistantInlineEditPresentation,
} from "./assistantInlineEditPresentation";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateRequest,
} from "../types";

const PROMPT_DRAG_GHOST_MIN_WIDTH_PX = 220;
const PROMPT_DRAG_GHOST_MAX_WIDTH_PX = 360;
const PROMPT_DRAG_GHOST_MAX_HEIGHT_PX = 220;
const STAGED_AGENT_OUTPUT_MESSAGE_ID = "staged-agent-output";
const CHAT_HISTORY_FOLLOW_THRESHOLD_PX = 24;
const CHAT_HISTORY_SCROLLBAR_INTENT_GUTTER_PX = 24;
const promptDragGhostMap = new WeakMap<HTMLElement, HTMLElement>();

const resolveAssistantPromptText = (message: AgentMessage): string | null => {
  if (message.role !== "assistant" || message.canUseAsPrompt !== true) return null;
  const outputPrompt = typeof message.outputPrompt === "string" ? message.outputPrompt.trim() : "";
  return outputPrompt.length > 0 ? outputPrompt : null;
};

const clearPromptDragGhost = (source: HTMLElement) => {
  const ghost = promptDragGhostMap.get(source);
  if (ghost?.parentNode) {
    ghost.parentNode.removeChild(ghost);
  }
  promptDragGhostMap.delete(source);
};

const createPromptDragGhost = (source: HTMLElement) => {
  clearPromptDragGhost(source);
  const rect = source.getBoundingClientRect();
  const preferredWidth = rect.width * 0.84;
  const width = Math.min(
    PROMPT_DRAG_GHOST_MAX_WIDTH_PX,
    Math.max(PROMPT_DRAG_GHOST_MIN_WIDTH_PX, preferredWidth)
  );
  const height = Math.min(PROMPT_DRAG_GHOST_MAX_HEIGHT_PX, rect.height);
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.classList.add("agent-message-drag-ghost");
  ghost.classList.remove("is-clickable", "is-draggable", "is-dragging");
  ghost.classList.remove(
    "agent-message--with-output-generate",
    "agent-message--with-output-thumbnail"
  );
  ghost.querySelectorAll(".agent-output-bubble-controls").forEach((node) => {
    node.remove();
  });
  ghost.style.width = `${width}px`;
  ghost.style.maxHeight = `${PROMPT_DRAG_GHOST_MAX_HEIGHT_PX}px`;
  ghost.style.position = "fixed";
  ghost.style.top = "-9999px";
  ghost.style.left = "-9999px";
  ghost.style.pointerEvents = "none";
  document.body.appendChild(ghost);
  promptDragGhostMap.set(source, ghost);
  return {
    ghost,
    offsetX: Math.round(width * 0.5),
    offsetY: Math.round(height * 0.5),
  };
};

export type AgentAssistantMessageContentProps = {
  message: AgentMessage;
  messageId: string;
  textRef: (node: HTMLElement | null) => void;
};

export type AgentChatPanelProps = {
  messages: AgentMessage[];
  input: string;
  sendLabel?: string;
  disabled?: boolean;
  isSending?: boolean;
  stagedPrompt?: string | null;
  introMessage?: AgentMessage | null;
  showMessages?: boolean;
  showInput?: boolean;
  showThinkingIndicator?: boolean;
  thinkingIndicatorPlacement?: "panel" | "history";
  dropHintText?: string;
  emptyStateText?: string;
  historyFooterContent?: React.ReactNode;
  stagedAttachments?: AgentAttachment[];
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  isDropActive?: boolean;
  showClearAttachmentsButton?: boolean;
  assistantMessageClassName?: string;
  AssistantMessageContent?: React.ComponentType<AgentAssistantMessageContentProps>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onMessageClick?: (message: AgentMessage) => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGenerateOutputPrompt?: (request: AgentOutputGenerateRequest) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAttachment?: (id: string) => void;
  onClearAttachments?: () => void;
  highlightLatestAssistantOnly?: boolean;
  disableOutputGenerate?: boolean;
  outputGenerateCostCredits?: number | null;
  outputGenerateGuardrailReason?: string | null;
  hideOutputGenerateControls?: boolean;
  preserveOutputGenerateLayoutWhenControlsHidden?: boolean;
};

export const AgentChatPanel: React.FC<AgentChatPanelProps> = ({
  messages,
  input,
  sendLabel = "Send",
  disabled = false,
  isSending = false,
  stagedPrompt = null,
  introMessage = null,
  showMessages = true,
  showInput = true,
  showThinkingIndicator = true,
  thinkingIndicatorPlacement = "panel",
  dropHintText = "Drag & drop reference cards here to attach context.",
  emptyStateText = "Drop references and send your next instruction.",
  historyFooterContent,
  stagedAttachments = [],
  assistantBubbleMedia,
  isDropActive = false,
  showClearAttachmentsButton = false,
  assistantMessageClassName,
  AssistantMessageContent,
  onInputChange,
  onSend,
  onMessageClick,
  onAssistantMessageEdit,
  onGenerateOutputPrompt,
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onRemoveAttachment,
  onClearAttachments,
  highlightLatestAssistantOnly = false,
  disableOutputGenerate = false,
  outputGenerateCostCredits = null,
  outputGenerateGuardrailReason = null,
  hideOutputGenerateControls = false,
  preserveOutputGenerateLayoutWhenControlsHidden = false,
}) => {
  const messagesRef = useRef<HTMLDivElement>(null);
  const shouldFollowHistoryRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const assistantMessageTextNodesRef = useRef<Map<string, HTMLElement>>(new Map());
  const skipBlurCommitRef = useRef(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingOriginalValue, setEditingOriginalValue] = useState("");
  const [editingPresentation, setEditingPresentation] =
    useState<AssistantInlineEditPresentation | null>(null);
  const editingInlineStyle = useMemo(
    () => resolveAssistantInlineEditStyle(editingPresentation),
    [editingPresentation]
  );
  const latestAssistantMessageIndex = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "assistant") {
        return index;
      }
    }
    return -1;
  })();
  const shouldShowThinkingIndicator = showThinkingIndicator && isSending;
  const shouldRenderThinkingInHistory =
    shouldShowThinkingIndicator && thinkingIndicatorPlacement === "history";
  const inlineOutputGenerateGuardrailReason = hideOutputGenerateControls
    ? null
    : outputGenerateGuardrailReason;
  const latestMessage = messages[messages.length - 1] ?? null;
  const latestMessageScrollKey = latestMessage
    ? [
        latestMessage.id ?? "",
        latestMessage.role,
        latestMessage.content.length,
        latestMessage.attachments?.length ?? 0,
      ].join(":")
    : "";
  const historyFooterVisible = Boolean(historyFooterContent);

  const syncHistoryFollowState = useCallback((messagesEl: HTMLDivElement) => {
    const scrollBottomGap =
      messagesEl.scrollHeight - messagesEl.clientHeight - messagesEl.scrollTop;
    shouldFollowHistoryRef.current = scrollBottomGap <= CHAT_HISTORY_FOLLOW_THRESHOLD_PX;
  }, []);

  const stopFollowingHistory = useCallback(() => {
    shouldFollowHistoryRef.current = false;
  }, []);

  const handleMessagesScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      syncHistoryFollowState(event.currentTarget);
    },
    [syncHistoryFollowState]
  );

  const handleMessagesWheelCapture = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (event.deltaY < 0) {
        stopFollowingHistory();
      }
    },
    [stopFollowingHistory]
  );

  const handleMessagesPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const messagesEl = event.currentTarget;
      if (messagesEl.scrollHeight <= messagesEl.clientHeight) return;
      const rect = messagesEl.getBoundingClientRect();
      if (event.clientX >= rect.right - CHAT_HISTORY_SCROLLBAR_INTENT_GUTTER_PX) {
        stopFollowingHistory();
      }
    },
    [stopFollowingHistory]
  );

  useEffect(() => {
    const messagesEl = messagesRef.current;
    if (messagesEl && shouldFollowHistoryRef.current) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }, [
    historyFooterVisible,
    latestMessageScrollKey,
    messages.length,
    shouldRenderThinkingInHistory,
    stagedAttachments.length,
    stagedPrompt,
  ]);

  useEffect(
    () => () => {
      if (typeof document === "undefined") return;
      document.querySelectorAll(".agent-message-drag-ghost").forEach((node) => {
        node.parentNode?.removeChild(node);
      });
    },
    []
  );

  useEffect(() => {
    if (!editingMessageId) return;
    const editor = editInputRef.current;
    if (!editor) return;
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
  }, [editingMessageId]);

  const handleMessageClick = useCallback(
    (message: AgentMessage) => {
      if (!onMessageClick) return;
      if (message.role === "assistant" || message.role === "user") {
        onMessageClick(message);
      }
    },
    [onMessageClick]
  );

  const handleMessageKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, message: AgentMessage) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleMessageClick(message);
    },
    [handleMessageClick]
  );

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      if (disabled || isSending) return;
      onSend();
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [disabled, isSending, onSend]
  );

  const handleSendClick = useCallback(() => {
    if (disabled || isSending) return;
    onSend();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [disabled, isSending, onSend]);

  const handlePromptDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, promptText: string) => {
      const dragTarget = event.target;
      if (dragTarget instanceof Element && dragTarget.closest(".agent-output-bubble-media")) {
        event.preventDefault();
        return;
      }
      const normalizedPrompt = promptText.trim();
      if (!normalizedPrompt) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/plain", normalizedPrompt);
      event.dataTransfer.setData("text/prompt", normalizedPrompt);
      const source = event.currentTarget;
      if (typeof event.dataTransfer.setDragImage === "function") {
        try {
          const { ghost, offsetX, offsetY } = createPromptDragGhost(source);
          event.dataTransfer.setDragImage(ghost, offsetX, offsetY);
        } catch {
          event.dataTransfer.setDragImage(source, source.offsetWidth / 2, source.offsetHeight / 2);
        }
      }
      source.classList.add("is-dragging");
    },
    []
  );

  const handlePromptDragEnd = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const source = event.currentTarget;
    source.classList.remove("is-dragging");
    clearPromptDragGhost(source);
  }, []);

  const handleOutputBubbleMediaDragStart = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleOutputGenerateClick = useCallback(
    (request: AgentOutputGenerateRequest) => {
      if (disableOutputGenerate) return;
      const normalizedPrompt = request.prompt.trim();
      if (!normalizedPrompt) return;
      onGenerateOutputPrompt?.({
        ...request,
        prompt: normalizedPrompt,
      });
    },
    [disableOutputGenerate, onGenerateOutputPrompt]
  );

  const setAssistantMessageTextRef = useCallback((messageId: string, node: HTMLElement | null) => {
    const normalizedMessageId = messageId.trim();
    if (!normalizedMessageId) return;
    if (node) {
      assistantMessageTextNodesRef.current.set(normalizedMessageId, node);
      return;
    }
    assistantMessageTextNodesRef.current.delete(normalizedMessageId);
  }, []);

  const startAssistantMessageEdit = useCallback(
    (message: AgentMessage) => {
      if (!onAssistantMessageEdit) return;
      if (message.role !== "assistant") return;
      const messageId = message.id?.trim();
      if (!messageId) return;
      const sourceTextNode = assistantMessageTextNodesRef.current.get(messageId) ?? null;
      setEditingMessageId(messageId);
      setEditingValue(message.content);
      setEditingOriginalValue(message.content);
      setEditingPresentation(captureAssistantInlineEditPresentation(sourceTextNode));
      skipBlurCommitRef.current = false;
    },
    [onAssistantMessageEdit]
  );

  const cancelAssistantMessageEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingValue("");
    setEditingOriginalValue("");
    setEditingPresentation(null);
    skipBlurCommitRef.current = false;
  }, []);

  const commitAssistantMessageEdit = useCallback(() => {
    if (!onAssistantMessageEdit || !editingMessageId) {
      cancelAssistantMessageEdit();
      return;
    }
    const normalizedNext = editingValue.trim();
    const normalizedCurrent = editingOriginalValue.trim();
    if (!normalizedNext || normalizedNext === normalizedCurrent) {
      cancelAssistantMessageEdit();
      return;
    }
    const didCommit = onAssistantMessageEdit({
      messageId: editingMessageId,
      content: normalizedNext,
    });
    if (didCommit) {
      cancelAssistantMessageEdit();
    }
  }, [
    cancelAssistantMessageEdit,
    editingMessageId,
    editingOriginalValue,
    editingValue,
    onAssistantMessageEdit,
  ]);

  const resolveBubbleMediaState = useCallback(
    (messageId: string): AgentOutputBubbleMediaState | null => {
      const normalizedMessageId = messageId.trim();
      if (!normalizedMessageId) return null;
      return assistantBubbleMedia?.[normalizedMessageId] ?? null;
    },
    [assistantBubbleMedia]
  );

  const renderOutputBubbleMedia = useCallback(
    (mediaState: AgentOutputBubbleMediaState | null) => {
      if (!mediaState || mediaState.state === "idle") return null;
      if (mediaState.thumbnailUrl) {
        return (
          <div
            className="agent-output-bubble-media"
            data-state={mediaState.state}
            onDragStart={handleOutputBubbleMediaDragStart}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaState.thumbnailUrl}
              alt="Generated output preview"
              loading="lazy"
              draggable={false}
              onDragStart={handleOutputBubbleMediaDragStart}
            />
          </div>
        );
      }
      if (mediaState.state === "pending") {
        return (
          <div
            className="agent-output-bubble-media agent-output-bubble-media--status"
            data-state="pending"
            onDragStart={handleOutputBubbleMediaDragStart}
          >
            <span className="tiny">Generating preview…</span>
          </div>
        );
      }
      if (mediaState.state === "failed") {
        return (
          <div
            className="agent-output-bubble-media agent-output-bubble-media--status"
            data-state="failed"
            onDragStart={handleOutputBubbleMediaDragStart}
          >
            <span className="tiny">Generation failed</span>
          </div>
        );
      }
      return null;
    },
    [handleOutputBubbleMediaDragStart]
  );

  const renderAttachmentCards = useCallback(
    (
      attachments: AgentAttachment[],
      options?: {
        removable?: boolean;
        compact?: boolean;
      }
    ) => {
      const removable = options?.removable ?? false;
      const compact = options?.compact ?? false;
      if (!attachments.length) return null;
      return (
        <div
          className={`agent-attachment-card-list${compact ? " agent-attachment-card-list--message" : ""}`}
        >
          {attachments.map((attachment) => {
            const isLinkedPromptRef =
              attachment.kind === "prompt" && Boolean(attachment.referenceId);
            const attachmentStatusClass =
              attachment.kind === "image" ? `is-${attachment.deliveryStatus ?? "pending"}` : "";
            const projectedImageAttachment =
              attachment.kind === "image"
                ? projectAgentAttachmentToComposerImageAttachment(attachment)
                : null;
            return (
              <div
                key={attachment.id}
                className={`agent-attachment-card${compact ? " agent-attachment-card--message" : ""} agent-attachment-card--${attachment.kind} ${isLinkedPromptRef ? "is-linked-prompt-ref" : ""} ${attachmentStatusClass}`.trim()}
              >
                {attachment.kind === "image" ? (
                  <AgentImageAttachmentPreview
                    src={projectedImageAttachment?.preview.url ?? null}
                    sources={projectedImageAttachment?.preview.candidates ?? null}
                  />
                ) : (
                  <div className="agent-attachment-card-prompt" aria-hidden="true">
                    <span className="agent-attachment-card-prompt-marker">T</span>
                  </div>
                )}
                {isLinkedPromptRef ? (
                  <span className="agent-attachment-link-dot" aria-hidden="true" />
                ) : null}
                {removable && onRemoveAttachment ? (
                  <button
                    type="button"
                    className="agent-attachment-remove agent-attachment-remove--card"
                    aria-label="Remove attachment"
                    onClick={() => onRemoveAttachment(attachment.id)}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      );
    },
    [onRemoveAttachment]
  );

  return (
    <div
      className={`agent-chat-panel${highlightLatestAssistantOnly ? " agent-chat-panel--latest-assistant-only" : ""}`}
    >
      {showMessages ? (
        <div
          className={`agent-chat-surface${isDropActive ? " is-drop-active" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
        >
          <div className="agent-chat-surface-head">
            {dropHintText ? (
              <p className="tiny helper-text agent-drop-hint">{dropHintText}</p>
            ) : null}
            {showClearAttachmentsButton && stagedAttachments.length && onClearAttachments ? (
              <button
                type="button"
                className="ghost-btn mini agent-attachment-clear-btn"
                onClick={onClearAttachments}
                aria-label="Clear attached references"
              >
                Clear refs
              </button>
            ) : null}
          </div>
          {disableOutputGenerate && inlineOutputGenerateGuardrailReason ? (
            <div className="inline-warning-hint">{inlineOutputGenerateGuardrailReason}</div>
          ) : null}
          {introMessage ||
          stagedPrompt ||
          messages.length > 0 ||
          stagedAttachments.length > 0 ||
          historyFooterContent ||
          shouldRenderThinkingInHistory ? (
            <div
              className="agent-messages"
              aria-live="polite"
              ref={messagesRef}
              onPointerDownCapture={handleMessagesPointerDownCapture}
              onScroll={handleMessagesScroll}
              onWheelCapture={handleMessagesWheelCapture}
            >
              {introMessage ? (
                <div className="agent-message agent-assistant agent-intro">
                  <p className="tiny">{introMessage.content}</p>
                </div>
              ) : null}
              {stagedPrompt
                ? (() => {
                    const stagedBubbleMedia = resolveBubbleMediaState(
                      STAGED_AGENT_OUTPUT_MESSAGE_ID
                    );
                    return (
                      <div
                        className={`agent-message agent-assistant ${
                          highlightLatestAssistantOnly && latestAssistantMessageIndex < 0
                            ? "is-latest-assistant"
                            : ""
                        } is-draggable agent-message--with-output-generate ${
                          stagedBubbleMedia && stagedBubbleMedia.state !== "idle"
                            ? "agent-message--with-output-thumbnail"
                            : ""
                        } agent-message--prompt-output`.trim()}
                        draggable
                        onDragStart={(event) => handlePromptDragStart(event, stagedPrompt)}
                        onDragEnd={handlePromptDragEnd}
                      >
                        <p className="tiny">{stagedPrompt}</p>
                        {stagedBubbleMedia || !hideOutputGenerateControls ? (
                          <div className="agent-output-bubble-controls">
                            {renderOutputBubbleMedia(stagedBubbleMedia)}
                            {hideOutputGenerateControls ? null : (
                              <AgentResponseInlineGenerateButton
                                onClick={() =>
                                  handleOutputGenerateClick({
                                    messageId: STAGED_AGENT_OUTPUT_MESSAGE_ID,
                                    prompt: stagedPrompt,
                                    source: "staged",
                                  })
                                }
                                costCredits={outputGenerateCostCredits}
                                ariaLabel="Generate from this agent output"
                                disabled={disableOutputGenerate}
                                stopPropagation
                              />
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })()
                : null}
              {messages.map((message, index) => {
                const isClickable = Boolean(onMessageClick);
                const resolvedMessageId = message.id?.trim() || `history-agent-output-${index}`;
                const isEditingMessage =
                  Boolean(editingMessageId) && editingMessageId === resolvedMessageId;
                const assistantPromptText = resolveAssistantPromptText(message);
                const isAssistantPromptOutput = Boolean(assistantPromptText);
                const canUseMessageAsPrompt =
                  message.role === "assistant" ? Boolean(assistantPromptText) : true;
                const draggablePromptText =
                  message.role === "assistant" ? assistantPromptText : message.content.trim();
                const isDraggable =
                  (message.role === "assistant" || message.role === "user") &&
                  Boolean(draggablePromptText) &&
                  (message.role !== "assistant" || canUseMessageAsPrompt) &&
                  !isEditingMessage;
                const bubbleMedia = resolveBubbleMediaState(resolvedMessageId);
                const showOutputGenerateButton =
                  message.role === "assistant" &&
                  !hideOutputGenerateControls &&
                  canUseMessageAsPrompt;
                const showOutputBubbleControls =
                  Boolean(bubbleMedia && bubbleMedia.state !== "idle") || showOutputGenerateButton;
                const shouldUseOutputGenerateLayout =
                  showOutputGenerateButton ||
                  (preserveOutputGenerateLayoutWhenControlsHidden &&
                    Boolean(bubbleMedia && bubbleMedia.state !== "idle"));
                const isLatestAssistantMessage =
                  highlightLatestAssistantOnly &&
                  message.role === "assistant" &&
                  index === latestAssistantMessageIndex;
                const isStaleAssistantMessage =
                  highlightLatestAssistantOnly &&
                  message.role === "assistant" &&
                  index !== latestAssistantMessageIndex;
                const hasOutputThumbnail = Boolean(bubbleMedia && bubbleMedia.state !== "idle");
                const messageAttachments = message.attachments ?? [];
                const hasMessageAttachments = messageAttachments.length > 0;
                const hasMessageContent = Boolean(message.content.trim());
                const resolvedAssistantMessageClassName =
                  message.role === "assistant" && assistantMessageClassName
                    ? ` ${assistantMessageClassName}`
                    : "";
                const key =
                  message.id || `${message.role}-${index}-${message.content.slice(0, 12)}`;
                return (
                  <div
                    key={key}
                    className={`agent-message agent-${message.role}${isClickable ? " is-clickable" : ""}${isDraggable ? " is-draggable" : ""}${isLatestAssistantMessage ? " is-latest-assistant" : ""}${isStaleAssistantMessage ? " is-stale-assistant" : ""}${isAssistantPromptOutput ? " agent-message--prompt-output" : ""}${shouldUseOutputGenerateLayout ? " agent-message--with-output-generate" : ""}${hasOutputThumbnail ? " agent-message--with-output-thumbnail" : ""}${hasMessageAttachments ? " agent-message--with-attachments" : ""}${isEditingMessage ? " is-editing-assistant-message" : ""}${resolvedAssistantMessageClassName}`}
                    onClick={
                      isClickable && !isEditingMessage
                        ? () => handleMessageClick(message)
                        : undefined
                    }
                    onDoubleClick={
                      !isEditingMessage ? () => startAssistantMessageEdit(message) : undefined
                    }
                    onKeyDown={
                      isClickable && !isEditingMessage
                        ? (event) => handleMessageKeyDown(event, message)
                        : undefined
                    }
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    draggable={isDraggable}
                    onDragStart={
                      isDraggable
                        ? (event) => handlePromptDragStart(event, draggablePromptText ?? "")
                        : undefined
                    }
                    onDragEnd={isDraggable ? handlePromptDragEnd : undefined}
                  >
                    {isEditingMessage ? (
                      <textarea
                        ref={editInputRef}
                        value={editingValue}
                        className="agent-message-edit-input tiny"
                        style={editingInlineStyle}
                        aria-label="Edit assistant message"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        onChange={(event) => {
                          setEditingValue(event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            skipBlurCommitRef.current = true;
                            cancelAssistantMessageEdit();
                            return;
                          }
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            skipBlurCommitRef.current = true;
                            commitAssistantMessageEdit();
                          }
                        }}
                        onBlur={() => {
                          if (skipBlurCommitRef.current) {
                            skipBlurCommitRef.current = false;
                            return;
                          }
                          commitAssistantMessageEdit();
                        }}
                      />
                    ) : (
                      <div className="agent-message-body">
                        {hasMessageAttachments ? (
                          <div className="agent-message-attachments">
                            {renderAttachmentCards(messageAttachments, { compact: true })}
                          </div>
                        ) : null}
                        {hasMessageContent ? (
                          message.role === "assistant" && AssistantMessageContent ? (
                            <AssistantMessageContent
                              message={message}
                              messageId={resolvedMessageId}
                              textRef={(node) =>
                                setAssistantMessageTextRef(resolvedMessageId, node)
                              }
                            />
                          ) : (
                            <p
                              className="tiny"
                              ref={
                                message.role === "assistant"
                                  ? (node) => setAssistantMessageTextRef(resolvedMessageId, node)
                                  : undefined
                              }
                            >
                              {message.content}
                            </p>
                          )
                        ) : null}
                      </div>
                    )}
                    {showOutputBubbleControls && !isEditingMessage ? (
                      <div className="agent-output-bubble-controls">
                        {renderOutputBubbleMedia(bubbleMedia)}
                        {showOutputGenerateButton ? (
                          <AgentResponseInlineGenerateButton
                            onClick={() =>
                              handleOutputGenerateClick({
                                messageId: resolvedMessageId,
                                prompt: assistantPromptText ?? "",
                                source: "history",
                              })
                            }
                            costCredits={outputGenerateCostCredits}
                            ariaLabel="Generate from this agent output"
                            disabled={disableOutputGenerate}
                            stopPropagation
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {stagedAttachments.length ? (
                <div
                  className="agent-message agent-user agent-user-attachments"
                  aria-label="Attached references"
                >
                  {renderAttachmentCards(stagedAttachments, { removable: true })}
                </div>
              ) : null}
              {historyFooterContent}
              {shouldRenderThinkingInHistory ? (
                <div className="agent-message agent-assistant agent-thinking-message">
                  <p className="tiny agent-thinking agent-thinking--history" aria-live="polite">
                    Thinking…
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="agent-chat-empty tiny">{emptyStateText}</div>
          )}
        </div>
      ) : null}
      {shouldShowThinkingIndicator && thinkingIndicatorPlacement !== "history" ? (
        <p className="agent-thinking" aria-live="polite">
          Thinking…
        </p>
      ) : null}
      {showInput ? (
        <div className="agent-input-row pill-agent-input-row">
          <AgentInputBar
            ref={inputRef}
            value={input}
            onChange={onInputChange}
            placeholder="Tell the agent what you want or ask it to describe a reference."
            disabled={disabled}
            className="agent-input-prefab-inline"
            onKeyDown={handleInputKeyDown}
          />
          <div className="agent-inline-actions">
            <AgentSendButton
              onClick={handleSendClick}
              disabled={disabled || isSending}
              loading={isSending}
              ariaLabel={sendLabel}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
