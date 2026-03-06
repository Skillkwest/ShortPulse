/**
 * AI Studio shell frame boundary.
 * Owns shell structure, drag/drop overlay plumbing, and conditional right-column composition.
 */
import React from "react";
import { AgentChatPanel } from "../../../prefabs/agent";
import type {
  AgentActions,
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../ai-agent/types";
import type { ToolId } from "../types";
import type { ReferenceGridProps } from "./ReferenceGrid";
import { AiStudioPropertiesRail } from "./AiStudioPropertiesRail";
import { AiStudioReferenceRail } from "./AiStudioReferenceRail";
import { AiStudioPreviewRail } from "./AiStudioPreviewRail";
import { useOutputCounts } from "../hooks/aiStudioOutputStore";

type RightColumnDropMode = "none" | "text" | "media";

type AgentChatProps = {
  isOpen: boolean;
  agentMessages: AgentMessage[];
  agentActions?: AgentActions;
  agentInput: string;
  agentIsSending: boolean;
  latestAgentPrompt: string | null;
  agentPrimarySource?: "agent" | "manual" | "reference";
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
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onAgentDescribeTargets?: (targets: string[]) => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGenerateFromOutputPrompt?: (request: AgentOutputGenerateInput) => void;
  outputGenerateCostCredits?: number | null;
  disableOutputGenerate?: boolean;
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
  propertiesPanelContent: React.ReactNode;
  rightColumnDropMode: RightColumnDropMode;
  onRightColumnDropCapture: (event: React.DragEvent<HTMLElement>) => void;
  onRightColumnDragOverCapture: (event: React.DragEvent<HTMLElement>) => void;
  onRightColumnDragEnterCapture: (event: React.DragEvent<HTMLElement>) => void;
  onRightColumnDragLeaveCapture: (event: React.DragEvent<HTMLElement>) => void;
  onShellDragOverCapture: (event: React.DragEvent<HTMLElement>) => void;
  onShellDropCapture: (event: React.DragEvent<HTMLElement>) => void;
  agentChat: AgentChatProps;
  referenceGridProps: ReferenceGridProps;
  studioPreviewProps: React.ComponentProps<typeof AiStudioPreviewRail>["studioPreviewProps"];
  handleReferenceGridFiles: (files: FileList) => void;
  triggerFilePicker: () => void;
  onOpenMediaLibrary?: () => void;
  beginnerMode: boolean;
  rightColumnHidden?: boolean;
};

export const AiStudioShellFrame = React.memo(function AiStudioShellFrame({
  shellRef,
  leftColumnRef,
  rightColumnRef,
  shellClassName,
  shellStyle,
  selectedTool,
  showDivider,
  dividerProps,
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
        panelContent={propertiesPanelContent}
      />
      {showDivider ? <button type="button" className="ai-shell-divider" {...dividerProps} /> : null}
      <div
        ref={rightColumnRef}
        className={`ai-shell-right${rightColumnDropMode !== "none" ? " is-drop-overlay-active" : ""}`}
        data-right-column-hidden={rightColumnHidden ? "true" : undefined}
        onDropCapture={onRightColumnDropCapture}
        onDragOverCapture={onRightColumnDragOverCapture}
        onDragEnterCapture={onRightColumnDragEnterCapture}
        onDragLeaveCapture={onRightColumnDragLeaveCapture}
      >
        {agentChat.isOpen ? (
          <div className="ai-preview-column reference-column">
            <div className="reference-column-sticky">
              <div className="preview-column-header">
                <div>
                  <p className="eyebrow">Agent Chat</p>
                  <p className="tiny subdued helper-text">
                    Drag a chat bubble into the reference grid to add that text as a new prompt
                    card.
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
                showPromptActions
                showPrimaryPromptStatus={false}
                agentActions={agentChat.agentActions}
                primaryPrompt={agentChat.latestAgentPrompt}
                primarySource={agentChat.agentPrimarySource}
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
                onAgentApplyPrompt={agentChat.onAgentApplyPrompt}
                onAgentSelectVariation={agentChat.onAgentSelectVariation}
                onAgentDescribeTargets={agentChat.onAgentDescribeTargets}
                onAssistantMessageEdit={agentChat.onAssistantMessageEdit}
                onGenerateOutputPrompt={agentChat.onGenerateFromOutputPrompt}
                outputGenerateCostCredits={agentChat.outputGenerateCostCredits}
                disableOutputGenerate={agentChat.disableOutputGenerate}
                beginnerMode={beginnerMode}
              />
            </div>
          </div>
        ) : (
          <>
            <AiStudioReferenceRail
              referenceGridProps={referenceGridProps}
              onDropFiles={handleReferenceGridFiles}
              onTriggerFilePicker={triggerFilePicker}
              selectedTool={selectedTool}
              onOpenMediaLibrary={onOpenMediaLibrary}
            />
            <AiStudioPreviewRail
              studioPreviewProps={studioPreviewProps}
              onDropFiles={handleReferenceGridFiles}
              onTriggerFilePicker={triggerFilePicker}
              onOpenMediaLibrary={onOpenMediaLibrary}
            />
          </>
        )}
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
    </section>
  );
});
