/**
 * AI Studio shell frame boundary.
 * Owns shell structure, drag/drop overlay plumbing, and conditional right-column composition.
 */
import React from "react";
import { AgentChatPanel } from "../../../prefabs/agent";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../ai-agent/types";
import type { ToolId } from "../types";
import { AiStudioPropertiesRail } from "./AiStudioPropertiesRail";
import { AiStudioReferenceRail } from "./AiStudioReferenceRail";
import { AiStudioPreviewRail } from "./AiStudioPreviewRail";
import { useOutputCounts } from "../hooks/aiStudioOutputStore";
import type { AiStudioReferenceGridContract } from "../hooks/contracts/pageContentContracts";
import { areReferenceGridPropsEqual } from "../reference-grid/logic/referenceGridPropsEquality";

type RightColumnDropMode = "none" | "text" | "media";

type AgentChatProps = {
  isOpen: boolean;
  agentMessages: AgentMessage[];
  agentInput: string;
  agentIsSending: boolean;
  latestAgentPrompt: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  stagedAttachments: AgentAttachment[];
  agentDropActive: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAddToGrid: () => void;
  onClose: () => void;
  onAttachmentDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onAttachmentDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onAttachmentDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  onAttachmentDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAttachment: (id: string) => void;
  onClearAttachments: () => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGenerateFromOutputPrompt?: (request: AgentOutputGenerateInput) => void;
  outputGenerateCostCredits?: number | null;
  disableOutputGenerate?: boolean;
  outputGenerateGuardrailReason?: string | null;
};

type AiStudioShellFrameProps = {
  shellRef: React.RefObject<HTMLElement>;
  leftColumnRef: React.RefObject<HTMLElement>;
  rightColumnRef: React.RefObject<HTMLDivElement>;
  shellClassName: string;
  shellStyle?: React.CSSProperties;
  selectedTool: ToolId | null;
  showDivider: boolean;
  dividerProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  propertiesPanelKey: string | null;
  propertiesPanelContent: React.ReactNode;
  rightColumnDropMode: RightColumnDropMode;
  onRightColumnDropCapture: (event: React.DragEvent<HTMLElement>) => void;
  onRightColumnDragOverCapture: (event: React.DragEvent<HTMLElement>) => void;
  onRightColumnDragEnterCapture: (event: React.DragEvent<HTMLElement>) => void;
  onRightColumnDragLeaveCapture: (event: React.DragEvent<HTMLElement>) => void;
  onShellDragOverCapture: (event: React.DragEvent<HTMLElement>) => void;
  onShellDropCapture: (event: React.DragEvent<HTMLElement>) => void;
  agentChat: AgentChatProps;
  referenceGridProps: AiStudioReferenceGridContract;
  studioPreviewProps: React.ComponentProps<typeof AiStudioPreviewRail>["studioPreviewProps"];
  handleReferenceGridFiles: (files: FileList) => void;
  triggerFilePicker: () => void;
  onOpenMediaLibrary?: () => void;
  beginnerMode: boolean;
  rightColumnHidden?: boolean;
  showPreviewRail?: boolean;
};

type AiStudioShellRightColumnProps = {
  rightColumnRef: React.RefObject<HTMLDivElement>;
  rightColumnDropMode: RightColumnDropMode;
  rightColumnHidden?: boolean;
  onRightColumnDropCapture: (event: React.DragEvent<HTMLElement>) => void;
  onRightColumnDragOverCapture: (event: React.DragEvent<HTMLElement>) => void;
  onRightColumnDragEnterCapture: (event: React.DragEvent<HTMLElement>) => void;
  onRightColumnDragLeaveCapture: (event: React.DragEvent<HTMLElement>) => void;
  agentChat: AgentChatProps;
  referenceGridProps: AiStudioReferenceGridContract;
  studioPreviewProps: React.ComponentProps<typeof AiStudioPreviewRail>["studioPreviewProps"];
  handleReferenceGridFiles: (files: FileList) => void;
  triggerFilePicker: () => void;
  onOpenMediaLibrary?: () => void;
  beginnerMode: boolean;
  selectedTool: ToolId | null;
  showPreviewRail: boolean;
};

const areAiStudioShellRightColumnPropsEqual = (
  previous: Readonly<AiStudioShellRightColumnProps>,
  next: Readonly<AiStudioShellRightColumnProps>
): boolean => {
  if (previous.rightColumnRef !== next.rightColumnRef) return false;
  if (previous.rightColumnDropMode !== next.rightColumnDropMode) return false;
  if (previous.rightColumnHidden !== next.rightColumnHidden) return false;
  if (previous.onRightColumnDropCapture !== next.onRightColumnDropCapture) return false;
  if (previous.onRightColumnDragOverCapture !== next.onRightColumnDragOverCapture) return false;
  if (previous.onRightColumnDragEnterCapture !== next.onRightColumnDragEnterCapture) return false;
  if (previous.onRightColumnDragLeaveCapture !== next.onRightColumnDragLeaveCapture) return false;
  if (previous.agentChat !== next.agentChat) return false;
  if (!areReferenceGridPropsEqual(previous.referenceGridProps, next.referenceGridProps))
    return false;
  if (previous.studioPreviewProps !== next.studioPreviewProps) return false;
  if (previous.handleReferenceGridFiles !== next.handleReferenceGridFiles) return false;
  if (previous.triggerFilePicker !== next.triggerFilePicker) return false;
  if (previous.onOpenMediaLibrary !== next.onOpenMediaLibrary) return false;
  if (previous.beginnerMode !== next.beginnerMode) return false;
  if (previous.selectedTool !== next.selectedTool) return false;
  if (previous.showPreviewRail !== next.showPreviewRail) return false;
  return true;
};

const AiStudioShellRightColumn = React.memo(function AiStudioShellRightColumn({
  rightColumnRef,
  rightColumnDropMode,
  rightColumnHidden,
  onRightColumnDropCapture,
  onRightColumnDragOverCapture,
  onRightColumnDragEnterCapture,
  onRightColumnDragLeaveCapture,
  agentChat,
  referenceGridProps,
  studioPreviewProps,
  handleReferenceGridFiles,
  triggerFilePicker,
  onOpenMediaLibrary,
  beginnerMode,
  selectedTool,
  showPreviewRail,
}: AiStudioShellRightColumnProps) {
  const shouldRenderRightColumnContent = !rightColumnHidden;
  return (
    <div
      ref={rightColumnRef}
      className={`ai-shell-right${rightColumnDropMode !== "none" ? " is-drop-overlay-active" : ""}`}
      data-right-column-hidden={rightColumnHidden ? "true" : undefined}
      onDropCapture={onRightColumnDropCapture}
      onDragOverCapture={onRightColumnDragOverCapture}
      onDragEnterCapture={onRightColumnDragEnterCapture}
      onDragLeaveCapture={onRightColumnDragLeaveCapture}
    >
      {shouldRenderRightColumnContent && agentChat.isOpen ? (
        <div className="ai-preview-column reference-column">
          <div className="reference-column-sticky">
            <div className="preview-column-header">
              <div>
                <p className="eyebrow">Agent Chat</p>
                <p className="tiny subdued helper-text">
                  Drag a chat bubble into the reference grid to add that text as a new prompt card.
                </p>
              </div>
              <div className="preview-header-actions">
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={agentChat.onAddToGrid}
                  disabled={!agentChat.latestAgentPrompt}
                >
                  Add to grid
                </button>
                <button
                  type="button"
                  className="ghost-btn mini agent-chat-close-btn"
                  onClick={agentChat.onClose}
                  aria-label="Close agent chat"
                >
                  ×
                </button>
              </div>
            </div>
            <AgentChatPanel
              messages={agentChat.agentMessages}
              introMessage={{
                id: "agent-intro",
                role: "system",
                content:
                  "Hey, I'm your studio agent. Tell me what you want to create (subject, style, mood, framing) and I'll turn it into a generation-ready prompt.",
              }}
              input={agentChat.agentInput}
              sendLabel="Send"
              isSending={agentChat.agentIsSending}
              assistantBubbleMedia={agentChat.assistantBubbleMedia}
              stagedAttachments={agentChat.stagedAttachments}
              isDropActive={agentChat.agentDropActive}
              onDrop={agentChat.onAttachmentDrop}
              onDragOver={agentChat.onAttachmentDragOver}
              onDragEnter={agentChat.onAttachmentDragEnter}
              onDragLeave={agentChat.onAttachmentDragLeave}
              onRemoveAttachment={agentChat.onRemoveAttachment}
              onClearAttachments={agentChat.onClearAttachments}
              onInputChange={agentChat.onInputChange}
              onSend={agentChat.onSend}
              onAssistantMessageEdit={agentChat.onAssistantMessageEdit}
              onGenerateOutputPrompt={agentChat.onGenerateFromOutputPrompt}
              outputGenerateCostCredits={agentChat.outputGenerateCostCredits}
              disableOutputGenerate={agentChat.disableOutputGenerate}
              outputGenerateGuardrailReason={agentChat.outputGenerateGuardrailReason}
              beginnerMode={beginnerMode}
            />
          </div>
        </div>
      ) : shouldRenderRightColumnContent ? (
        <>
          <AiStudioReferenceRail
            referenceGridProps={referenceGridProps}
            onDropFiles={handleReferenceGridFiles}
            onTriggerFilePicker={triggerFilePicker}
            selectedTool={selectedTool}
            onOpenMediaLibrary={onOpenMediaLibrary}
          />
          {showPreviewRail ? (
            <AiStudioPreviewRail
              studioPreviewProps={studioPreviewProps}
              onDropFiles={handleReferenceGridFiles}
              onTriggerFilePicker={triggerFilePicker}
              onOpenMediaLibrary={onOpenMediaLibrary}
            />
          ) : null}
        </>
      ) : null}
      {rightColumnDropMode !== "none" ? (
        <div
          className="ai-right-drop-overlay"
          data-drop-mode={rightColumnDropMode}
          aria-hidden="true"
          onDrop={onRightColumnDropCapture}
          onDragOver={onRightColumnDragOverCapture}
          onDragEnter={onRightColumnDragEnterCapture}
          onDragLeave={onRightColumnDragLeaveCapture}
        />
      ) : null}
    </div>
  );
}, areAiStudioShellRightColumnPropsEqual);

export const AiStudioShellFrame = React.memo(function AiStudioShellFrame({
  shellRef,
  leftColumnRef,
  rightColumnRef,
  shellClassName,
  shellStyle,
  selectedTool,
  showDivider,
  dividerProps,
  propertiesPanelKey,
  propertiesPanelContent,
  rightColumnDropMode,
  onRightColumnDropCapture,
  onRightColumnDragOverCapture,
  onRightColumnDragEnterCapture,
  onRightColumnDragLeaveCapture,
  onShellDragOverCapture,
  onShellDropCapture,
  agentChat,
  referenceGridProps,
  studioPreviewProps,
  handleReferenceGridFiles,
  triggerFilePicker,
  onOpenMediaLibrary,
  beginnerMode,
  rightColumnHidden,
  showPreviewRail = true,
}: AiStudioShellFrameProps) {
  const { activeCount } = useOutputCounts();
  const isDenseSession = activeCount >= 40;
  return (
    <section
      ref={shellRef}
      className={shellClassName}
      data-dense-shell={isDenseSession ? "true" : "false"}
      style={shellStyle}
      onDragOverCapture={onShellDragOverCapture}
      onDropCapture={onShellDropCapture}
    >
      <AiStudioPropertiesRail
        selectedTool={selectedTool}
        leftColumnRef={leftColumnRef}
        panelKey={propertiesPanelKey}
        panelContent={propertiesPanelContent}
      />
      {showDivider ? <button type="button" className="ai-shell-divider" {...dividerProps} /> : null}
      <AiStudioShellRightColumn
        rightColumnRef={rightColumnRef}
        rightColumnDropMode={rightColumnDropMode}
        rightColumnHidden={rightColumnHidden}
        onRightColumnDropCapture={onRightColumnDropCapture}
        onRightColumnDragOverCapture={onRightColumnDragOverCapture}
        onRightColumnDragEnterCapture={onRightColumnDragEnterCapture}
        onRightColumnDragLeaveCapture={onRightColumnDragLeaveCapture}
        agentChat={agentChat}
        referenceGridProps={referenceGridProps}
        studioPreviewProps={studioPreviewProps}
        handleReferenceGridFiles={handleReferenceGridFiles}
        triggerFilePicker={triggerFilePicker}
        onOpenMediaLibrary={onOpenMediaLibrary}
        beginnerMode={beginnerMode}
        selectedTool={selectedTool}
        showPreviewRail={showPreviewRail}
      />
    </section>
  );
});
