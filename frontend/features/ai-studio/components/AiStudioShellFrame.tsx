/**
 * AI Studio shell frame boundary.
 * Owns shell structure, drag/drop overlay plumbing, and conditional right-column composition.
 */
import React from "react";
import type { ToolId } from "../types";
import type { AiShellLayoutMode } from "../logic/shellResize";
import { AiStudioPropertiesRail } from "./AiStudioPropertiesRail";
import { AiStudioReferenceRail } from "./AiStudioReferenceRail";
import { AiStudioPreviewRail } from "./AiStudioPreviewRail";
import { useOutputCounts } from "../hooks/aiStudioOutputStore";
import type { AiStudioReferenceGridContract } from "../hooks/contracts/pageContentContracts";
import { areReferenceGridPropsEqual } from "../reference-grid/logic/referenceGridPropsEquality";

type RightColumnDropMode = "none" | "text" | "media";

type AiStudioShellFrameProps = {
  shellRef: React.RefObject<HTMLElement>;
  leftColumnRef: React.RefObject<HTMLElement>;
  rightColumnRef: React.RefObject<HTMLDivElement>;
  shellClassName: string;
  shellStyle?: React.CSSProperties;
  shellLayoutMode: AiShellLayoutMode;
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
  referenceGridProps: AiStudioReferenceGridContract;
  studioPreviewProps: React.ComponentProps<typeof AiStudioPreviewRail>["studioPreviewProps"];
  handleReferenceGridFiles: (files: FileList) => void;
  triggerFilePicker: () => void;
  onOpenMediaLibrary?: () => void;
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
  referenceGridProps: AiStudioReferenceGridContract;
  studioPreviewProps: React.ComponentProps<typeof AiStudioPreviewRail>["studioPreviewProps"];
  handleReferenceGridFiles: (files: FileList) => void;
  triggerFilePicker: () => void;
  onOpenMediaLibrary?: () => void;
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
  if (!areReferenceGridPropsEqual(previous.referenceGridProps, next.referenceGridProps))
    return false;
  if (previous.studioPreviewProps !== next.studioPreviewProps) return false;
  if (previous.handleReferenceGridFiles !== next.handleReferenceGridFiles) return false;
  if (previous.triggerFilePicker !== next.triggerFilePicker) return false;
  if (previous.onOpenMediaLibrary !== next.onOpenMediaLibrary) return false;
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
  referenceGridProps,
  studioPreviewProps,
  handleReferenceGridFiles,
  triggerFilePicker,
  onOpenMediaLibrary,
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
      {shouldRenderRightColumnContent ? (
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
  shellLayoutMode,
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
  referenceGridProps,
  studioPreviewProps,
  handleReferenceGridFiles,
  triggerFilePicker,
  onOpenMediaLibrary,
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
      data-shell-layout-mode={shellLayoutMode}
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
        referenceGridProps={referenceGridProps}
        studioPreviewProps={studioPreviewProps}
        handleReferenceGridFiles={handleReferenceGridFiles}
        triggerFilePicker={triggerFilePicker}
        onOpenMediaLibrary={onOpenMediaLibrary}
        selectedTool={selectedTool}
        showPreviewRail={showPreviewRail}
      />
    </section>
  );
});
