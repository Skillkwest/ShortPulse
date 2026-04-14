/**
 * Shared prompt step component for AI Studio.
 * Handles prompt entry modes and Agent interactions.
 */
import React from "react";
import type { AgentMessage } from "../../../prefabs/agent";
import { extractDragDropPayload } from "../utils/dragDrop";
import { PromptStepChatSurface } from "./promptStep/PromptStepChatSurface";
import { PromptStepEnhancedSurface } from "./promptStep/PromptStepEnhancedSurface";
import { PromptStepHeader } from "./promptStep/PromptStepHeader";
import type { PromptStepProps } from "./promptStep/types";
export type { PromptStepProps } from "./promptStep/types";

export function PromptStep({
  stepNumber,
  title = "Choose Prompt Mode",
  subtitle = "Draft the prompt you want to use, or switch to Chat to have the agent craft one for you.",
  prompt,
  onPromptChange,
  agentEnabled = false,
  agentMessages = [],
  agentActions,
  agentInput = "",
  chatModeEnabled = true,
  agentAssistToggleAvailable = false,
  agentAssistEnabled = true,
  agentIsSending = false,
  agentError,
  agentPrimaryPrompt = null,
  agentPrimarySource = "manual",
  stagedPrompt = null,
  assistantBubbleMedia,
  stagedAttachments = [],
  agentDropActive = false,
  agentChatOpen = false,
  onAgentInputChange,
  onChatModeEnabledChange,
  onAgentAssistEnabledChange,
  onAgentSend,
  onAgentEnhanceSend,
  onAgentAttachmentDrop,
  onAgentAttachmentDragOver,
  onAgentAttachmentDragEnter,
  onAgentAttachmentDragLeave,
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onExpandChat,
  onClearAgentChat,
  onAgentApplyPrompt,
  onAgentSelectVariation,
  onAgentDescribeTargets,
  onAssistantMessageEdit,
  onGenerateOutputPrompt,
  chatModeInlineGenerate,
  useAgentResponseInlineGeneratePrefab = false,
  onSavePrompt,
  isCollapsed,
  onToggleCollapse,
  isGenerating = false,
  showGenerationThinkingInChat = true,
  shouldDisableSave = false,
  onDrop,
  onDragOver,
  className = "",
  beginnerMode = false,
  chatOnly = false,
  promptOnly = false,
  enhanceOnly = false,
  hideEnhanceButton = false,
  promptPlaceholder = "Describe what you want, then refine it.",
  beginnerSubtitle,
  beginnerTitle,
  promptSaveButtonClassName = "prompt-fab-save",
  promptSaveButtonUnstyled = false,
  beginnerPinHelperText,
  promptInlineAction = null,
  promptInlineActionClassName = "",
  chatPromptSaveButtonClassName = "",
  chatPromptSaveButtonUnstyled = false,
  embedSendButtonInInput = false,
  hideAgentIntroMessage = false,
  agentAttachmentDropTarget = "history",
  hideInputDropHint = false,
  hideEmptyAgentChatState = false,
  emptyAgentChatSpacerClassName = "",
  highlightLatestAssistantOnly = false,
  composerLeadingContent = null,
  chatComposerOverlayEnabled = false,
  stackTrailingComposerControls = false,
  agentInputMaxHeightPx,
  agentInputCollapseOnBlur = false,
  onAgentInputVisualRowCountChange,
  disableOutputGenerate = false,
  outputGenerateCostCredits = null,
  outputGenerateGuardrailReason = null,
  hideHeader = false,
  autoResize = false,
  autoResizeLayoutKey,
  promptTextareaRef,
  promptHighlightSegments,
  onPromptFocus,
  onPromptBlur,
  onPromptSelect,
  onPromptKeyDown,
}: PromptStepProps) {
  const [promptMode, setPromptMode] = React.useState<"enhanced" | "chat">(
    chatOnly ? "chat" : "enhanced"
  );
  const agentInputRef = React.useRef<HTMLTextAreaElement>(null);

  // Chat-only overrides local mode state; otherwise beginner mode defaults to enhanced prompt mode.
  React.useEffect(() => {
    if (promptOnly && promptMode !== "enhanced") {
      setPromptMode("enhanced");
      return;
    }
    if (chatOnly && promptMode !== "chat") {
      setPromptMode("chat");
      return;
    }
    if (!chatOnly && beginnerMode && promptMode !== "enhanced") {
      setPromptMode("enhanced");
    }
  }, [beginnerMode, chatOnly, promptMode, promptOnly]);

  const effectiveTitle = beginnerMode ? (beginnerTitle ?? "Build Your Prompt") : title;

  const handleEnhancedPromptKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onPromptKeyDown?.(event);
    if (event.defaultPrevented) {
      return;
    }
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      agentIsSending ||
      hideEnhanceButton ||
      !onAgentEnhanceSend
    ) {
      return;
    }
    event.preventDefault();
    onAgentEnhanceSend();
  };

  const handleAgentInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || agentIsSending || !chatModeEnabled) return;
    event.preventDefault();
    onAgentSend?.();
    // Keep focus in the composer so the user can immediately type the next message.
    requestAnimationFrame(() => agentInputRef.current?.focus());
  };

  const canExpandInlineChat = agentMessages.length > 0;
  const canUsePromptSurface = agentEnabled || enhanceOnly;
  const isChatMode = !promptOnly && !enhanceOnly && (chatOnly || promptMode === "chat");
  // Chat-only mode should not depend on "expanded chat" state now that the expand control is removed.
  const showInlineChat = isChatMode && (!agentChatOpen || chatOnly);
  const promptThinking = Boolean(agentIsSending || isGenerating);
  const chatThinking = Boolean(
    agentIsSending || (showGenerationThinkingInChat ? isGenerating : false)
  );
  const visibleSubtitle = beginnerMode ? beginnerSubtitle : subtitle;
  const canPinAgentInput = agentInput.trim().length > 0;
  const shouldDisableChatPin = chatPromptSaveButtonUnstyled
    ? false
    : shouldDisableSave || !canPinAgentInput;
  const showBeginnerChatPinTip = Boolean(beginnerMode && chatOnly && beginnerPinHelperText);
  const dropToInputComposer = agentAttachmentDropTarget === "input";
  const imageAttachmentCounts = React.useMemo(() => {
    const images = stagedAttachments.filter((attachment) => attachment.kind === "image");
    const total = images.length;
    const preparing = images.filter(
      (attachment) => (attachment.deliveryStatus ?? "pending") === "preparing"
    ).length;
    const ready = images.filter(
      (attachment) => (attachment.deliveryStatus ?? "pending") === "ready"
    ).length;
    const failed = images.filter(
      (attachment) => (attachment.deliveryStatus ?? "pending") === "failed"
    ).length;
    return {
      total,
      preparing,
      ready,
      failed,
    };
  }, [stagedAttachments]);
  const handleAgentSendClick = () => {
    if (!chatModeEnabled) return;
    onAgentSend?.();
    requestAnimationFrame(() => agentInputRef.current?.focus());
  };
  const blockHistoryDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };
  const handleComposerAttachmentDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const droppedPromptText = event.dataTransfer
      ? extractDragDropPayload(event.dataTransfer).promptText?.trim()
      : null;
    onAgentAttachmentDrop?.(event);
    if (!droppedPromptText) return;
    requestAnimationFrame(() => agentInputRef.current?.focus());
  };
  const historyDropHandlers = dropToInputComposer
    ? {
        onDrop: blockHistoryDrop,
        onDragOver: blockHistoryDrop,
        onDragEnter: undefined,
        onDragLeave: undefined,
      }
    : {
        onDrop: onAgentAttachmentDrop,
        onDragOver: onAgentAttachmentDragOver,
        onDragEnter: onAgentAttachmentDragEnter,
        onDragLeave: onAgentAttachmentDragLeave,
      };
  const inputDropHandlers = dropToInputComposer
    ? {
        onDrop: handleComposerAttachmentDrop,
        onDragOver: onAgentAttachmentDragOver,
        onDragEnter: onAgentAttachmentDragEnter,
        onDragLeave: onAgentAttachmentDragLeave,
      }
    : {
        onDrop: undefined,
        onDragOver: undefined,
        onDragEnter: undefined,
        onDragLeave: undefined,
      };
  const showComposerAttachments = dropToInputComposer && stagedAttachments.length > 0;

  const introMessage = React.useMemo<AgentMessage>(
    () => ({
      id: "agent-intro",
      role: "system",
      content:
        "Hey, I'm your studio agent. Tell me what you want to create and I'll turn it into a generation ready prompt.",
    }),
    []
  );

  return (
    <div
      className={`step-card prompt-step ${isCollapsed ? "is-collapsed" : ""} ${className}`}
      onClick={() => {
        // Only collapse if clicking the header or specific non-interactive areas if needed.
        // For now, consistent with other steps: clicking container expands if collapsed.
        if (isCollapsed) onToggleCollapse();
      }}
      role="group"
      aria-label={`${effectiveTitle} section`}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {!hideHeader ? (
        <PromptStepHeader
          beginnerMode={beginnerMode}
          stepNumber={stepNumber}
          effectiveTitle={effectiveTitle}
          visibleSubtitle={visibleSubtitle}
          chatOnly={chatOnly}
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
          onClearAgentChat={onClearAgentChat}
        />
      ) : null}
      {!isCollapsed || hideHeader ? (
        canUsePromptSurface ? (
          <>
            {showInlineChat ? (
              <PromptStepChatSurface
                beginnerMode={beginnerMode}
                chatOnly={chatOnly}
                promptOnly={promptOnly}
                enhanceOnly={enhanceOnly}
                promptMode={promptMode}
                setPromptMode={setPromptMode}
                onExpandChat={onExpandChat}
                onClearAgentChat={onClearAgentChat}
                agentChatOpen={agentChatOpen}
                canExpandInlineChat={canExpandInlineChat}
                promptThinking={chatThinking}
                hideAgentIntroMessage={hideAgentIntroMessage}
                hideEmptyAgentChatState={hideEmptyAgentChatState}
                emptyAgentChatSpacerClassName={emptyAgentChatSpacerClassName}
                agentMessages={agentMessages}
                introMessage={introMessage}
                stagedPrompt={stagedPrompt}
                assistantBubbleMedia={assistantBubbleMedia}
                stagedAttachments={stagedAttachments}
                dropToInputComposer={dropToInputComposer}
                hideInputDropHint={hideInputDropHint}
                agentDropActive={agentDropActive}
                historyDropHandlers={historyDropHandlers}
                inputDropHandlers={inputDropHandlers}
                onRemoveAgentAttachment={onRemoveAgentAttachment}
                onClearAgentAttachments={onClearAgentAttachments}
                onAgentInputChange={onAgentInputChange}
                chatModeEnabled={chatModeEnabled}
                onChatModeEnabledChange={onChatModeEnabledChange}
                agentAssistToggleAvailable={agentAssistToggleAvailable}
                agentAssistEnabled={agentAssistEnabled}
                onAgentAssistEnabledChange={onAgentAssistEnabledChange}
                onAgentSend={onAgentSend}
                onGenerateOutputPrompt={onGenerateOutputPrompt}
                chatModeInlineGenerate={chatModeInlineGenerate}
                useAgentResponseInlineGeneratePrefab={useAgentResponseInlineGeneratePrefab}
                highlightLatestAssistantOnly={highlightLatestAssistantOnly}
                disableOutputGenerate={disableOutputGenerate}
                outputGenerateCostCredits={outputGenerateCostCredits}
                outputGenerateGuardrailReason={outputGenerateGuardrailReason}
                composerLeadingContent={composerLeadingContent}
                chatComposerOverlayEnabled={chatComposerOverlayEnabled}
                stackTrailingComposerControls={stackTrailingComposerControls}
                showComposerAttachments={showComposerAttachments}
                agentInputRef={agentInputRef}
                agentInput={agentInput}
                handleAgentInputKeyDown={handleAgentInputKeyDown}
                agentInputMaxHeightPx={agentInputMaxHeightPx}
                agentInputCollapseOnBlur={agentInputCollapseOnBlur}
                onAgentInputVisualRowCountChange={onAgentInputVisualRowCountChange}
                embedSendButtonInInput={embedSendButtonInInput}
                handleAgentSendClick={handleAgentSendClick}
                agentIsSending={agentIsSending}
                onSavePrompt={onSavePrompt}
                shouldDisableChatPin={shouldDisableChatPin}
                showBeginnerChatPinTip={showBeginnerChatPinTip}
                beginnerPinHelperText={beginnerPinHelperText}
                chatPromptSaveButtonClassName={chatPromptSaveButtonClassName}
                chatPromptSaveButtonUnstyled={chatPromptSaveButtonUnstyled}
                imageAttachmentCounts={imageAttachmentCounts}
                agentPrimaryPrompt={agentPrimaryPrompt}
                prompt={prompt}
                agentPrimarySource={agentPrimarySource}
                agentActions={agentActions}
                onAgentApplyPrompt={onAgentApplyPrompt}
                onAgentSelectVariation={onAgentSelectVariation}
                onAgentDescribeTargets={onAgentDescribeTargets}
                onAssistantMessageEdit={onAssistantMessageEdit}
              />
            ) : (
              <PromptStepEnhancedSurface
                prompt={prompt}
                onPromptChange={onPromptChange}
                handleEnhancedPromptKeyDown={handleEnhancedPromptKeyDown}
                promptThinking={promptThinking}
                promptPlaceholder={promptPlaceholder}
                beginnerMode={beginnerMode}
                beginnerPinHelperText={beginnerPinHelperText}
                hideEnhanceButton={hideEnhanceButton}
                enhanceOnly={enhanceOnly}
                onAgentEnhanceSend={onAgentEnhanceSend}
                onAgentSend={onAgentSend}
                agentIsSending={agentIsSending}
                onSavePrompt={onSavePrompt}
                shouldDisableSave={shouldDisableSave}
                promptSaveButtonClassName={promptSaveButtonClassName}
                promptSaveButtonUnstyled={promptSaveButtonUnstyled}
                autoResize={autoResize}
                autoResizeLayoutKey={autoResizeLayoutKey}
                inlineAction={promptInlineAction}
                inlineActionClassName={promptInlineActionClassName}
                promptTextareaRef={promptTextareaRef}
                promptHighlightSegments={promptHighlightSegments}
                onPromptDrop={onDrop}
                onPromptDragOver={onDragOver}
                onPromptFocus={onPromptFocus}
                onPromptBlur={onPromptBlur}
                onPromptSelect={onPromptSelect}
              />
            )}
          </>
        ) : (
          <div className="prompt-placeholder helper-text">
            <p className="prompt-placeholder-highlight">Prompt mode disabled</p>
            <p>Components are not active.</p>
          </div>
        )
      ) : null}
      {canUsePromptSurface && agentError && !isCollapsed ? (
        <div className="inline-error-hint">{agentError}</div>
      ) : null}
    </div>
  );
}
