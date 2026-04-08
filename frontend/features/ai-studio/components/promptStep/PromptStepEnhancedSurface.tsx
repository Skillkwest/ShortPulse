/**
 * PromptStep enhanced prompt surface.
 * Renders prompt textarea plus enhance/save actions.
 */
import React from "react";
import { AgentEnhanceButton, AgentSaveButton } from "../../../../prefabs/agent";
import type { PromptTokenHighlightSegment } from "../../logic/promptTokenHighlight";
import { syncTextareaMirrorScroll } from "../edit/expertEditInteractionUtils";

type PromptStepEnhancedSurfaceProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  handleEnhancedPromptKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  promptThinking: boolean;
  promptPlaceholder: string;
  beginnerMode: boolean;
  beginnerPinHelperText?: string;
  hideEnhanceButton: boolean;
  enhanceOnly: boolean;
  onAgentEnhanceSend?: () => void;
  onAgentSend?: () => void;
  agentIsSending: boolean;
  onSavePrompt?: (customPrompt?: string) => void;
  shouldDisableSave: boolean;
  promptSaveButtonClassName: string;
  promptSaveButtonUnstyled: boolean;
  autoResize: boolean;
  autoResizeLayoutKey?: string | number;
  inlineAction?: React.ReactNode;
  inlineActionClassName?: string;
  promptTextareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  promptHighlightSegments?: PromptTokenHighlightSegment[];
  onPromptFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onPromptBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onPromptSelect?: (event: React.SyntheticEvent<HTMLTextAreaElement>) => void;
};

export const PromptStepEnhancedSurface: React.FC<PromptStepEnhancedSurfaceProps> = ({
  prompt,
  onPromptChange,
  handleEnhancedPromptKeyDown,
  promptThinking,
  promptPlaceholder,
  beginnerMode,
  beginnerPinHelperText,
  hideEnhanceButton,
  enhanceOnly,
  onAgentEnhanceSend,
  onAgentSend,
  agentIsSending,
  onSavePrompt,
  shouldDisableSave,
  promptSaveButtonClassName,
  promptSaveButtonUnstyled,
  autoResize,
  autoResizeLayoutKey,
  inlineAction,
  inlineActionClassName,
  promptTextareaRef,
  promptHighlightSegments,
  onPromptFocus,
  onPromptBlur,
  onPromptSelect,
}) => {
  const localTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = promptTextareaRef ?? localTextareaRef;
  const assignTextareaRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      localTextareaRef.current = node;
      if (promptTextareaRef) {
        promptTextareaRef.current = node;
      }
    },
    [promptTextareaRef]
  );
  const promptHighlightRef = React.useRef<HTMLDivElement | null>(null);
  const hasPromptTokenHighlight = Boolean(
    promptHighlightSegments?.some((segment) => segment.kind !== "plain")
  );
  const resizeTextareaToViewport = React.useCallback(() => {
    if (!autoResize || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const computedMinHeight = Number.parseFloat(window.getComputedStyle(textarea).minHeight) || 0;
    const rect = textarea.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const bottomViewportInset = 150;
    const availableHeight = Math.max(
      viewportHeight - rect.top - bottomViewportInset,
      computedMinHeight
    );

    textarea.style.height = "auto";
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, computedMinHeight),
      availableHeight
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > availableHeight ? "auto" : "hidden";
  }, [autoResize, textareaRef]);

  const handlePromptScroll = React.useCallback(() => {
    if (!hasPromptTokenHighlight) return;
    syncTextareaMirrorScroll({
      textarea: textareaRef.current,
      mirror: promptHighlightRef.current,
    });
  }, [hasPromptTokenHighlight, textareaRef]);

  React.useEffect(() => {
    if (!autoResize || !textareaRef.current) return;
    const frameId = window.requestAnimationFrame(() => {
      resizeTextareaToViewport();
      handlePromptScroll();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    autoResize,
    autoResizeLayoutKey,
    prompt,
    resizeTextareaToViewport,
    textareaRef,
    handlePromptScroll,
  ]);

  React.useEffect(() => {
    if (!autoResize) return;
    const handleViewportResize = () => resizeTextareaToViewport();
    window.addEventListener("resize", handleViewportResize);
    return () => window.removeEventListener("resize", handleViewportResize);
  }, [autoResize, resizeTextareaToViewport, textareaRef]);

  React.useEffect(() => {
    if (!autoResize || !textareaRef.current || typeof ResizeObserver === "undefined") return;
    const textarea = textareaRef.current;
    const observedNodes = [
      textarea.parentElement,
      textarea.closest(".video-shot-workspace-stack"),
      textarea.closest(".video-direction-column-shell"),
    ].filter((node): node is Element => Boolean(node));

    if (!observedNodes.length) return;

    const observer = new ResizeObserver(() => {
      resizeTextareaToViewport();
    });

    observedNodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [autoResize, resizeTextareaToViewport, textareaRef]);

  React.useEffect(() => {
    handlePromptScroll();
  }, [handlePromptScroll, prompt]);

  return (
    <>
      <div className="step2-input-row enhanced-mode">
        <div
          className={`prompt-enhanced-wrapper ${hasPromptTokenHighlight ? "has-token-highlight" : ""}`.trim()}
        >
          {hasPromptTokenHighlight ? (
            <div ref={promptHighlightRef} className="prompt-token-highlight" aria-hidden="true">
              {promptHighlightSegments?.map((segment, index) => (
                <span
                  key={`prompt-token-highlight-${index}-${segment.kind}`}
                  className={`prompt-token-highlight-segment is-${segment.kind}`}
                >
                  {segment.text}
                </span>
              ))}
              <span className="prompt-token-highlight-segment prompt-token-highlight-segment--buffer">
                {"\n"}
              </span>
            </div>
          ) : null}
          {promptThinking ? (
            <div className="prompt-thinking-overlay" aria-live="polite">
              <span className="prompt-thinking-text">Thinking...</span>
            </div>
          ) : null}
          <textarea
            ref={assignTextareaRef}
            className="prompt-input agent-step-textarea enhanced-prompt-input"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={handleEnhancedPromptKeyDown}
            onFocus={onPromptFocus}
            onBlur={onPromptBlur}
            onSelect={onPromptSelect}
            onScroll={handlePromptScroll}
            rows={6}
            placeholder={promptPlaceholder}
            aria-busy={promptThinking}
          />
          {inlineAction ? (
            <div className={`prompt-inline-action-slot ${inlineActionClassName ?? ""}`.trim()}>
              {inlineAction}
            </div>
          ) : null}
        </div>
      </div>
      <div className="enhanced-actions-row prompt-actions-compact">
        {beginnerMode && beginnerPinHelperText ? (
          <p className="tiny helper-text beginner-pin-helper">
            <span className="beginner-pin-helper-prefix">Tip:</span>
            <span>{beginnerPinHelperText}</span>
          </p>
        ) : null}
        <div className="enhanced-action-buttons agent-inline-actions">
          {!hideEnhanceButton ? (
            <AgentEnhanceButton
              onClick={
                enhanceOnly
                  ? (onAgentEnhanceSend ?? (() => {}))
                  : (onAgentEnhanceSend ?? onAgentSend ?? (() => {}))
              }
              disabled={agentIsSending}
              ariaLabel="Enhance prompt"
              className="prompt-fab-send"
            />
          ) : null}
          {onSavePrompt ? (
            <AgentSaveButton
              onClick={onSavePrompt}
              disabled={shouldDisableSave}
              ariaLabel={enhanceOnly ? "Pin prompt" : "Save prompt"}
              className={promptSaveButtonClassName}
              unstyled={promptSaveButtonUnstyled}
            />
          ) : null}
        </div>
      </div>
    </>
  );
};
