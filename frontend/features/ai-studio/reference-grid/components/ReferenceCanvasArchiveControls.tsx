import React from "react";
import { CloudArrowUp, UploadSimple } from "phosphor-react";
import { PromptLibraryButton } from "../../components/PromptLibraryButton";
import type { StudioOutput } from "../../types";

type ReferenceGridArchiveControlsProps = {
  archiveCount: number;
  showHeader: boolean;
  isArchivePanelOpen: boolean;
  archivedOutputs: StudioOutput[];
  onToggleArchivePanel: () => void;
  onTriggerFileSelect?: () => void;
  onOpenMediaLibrary?: () => void;
  onRestoreArchivedOutput?: (id: string) => void;
  onRestoreAllArchivedOutputs?: () => void;
};

/**
 * Shared header + archive inline/panel controls for all-refs and split-grid surfaces.
 */
export function ReferenceGridArchiveControls({
  archiveCount,
  showHeader,
  isArchivePanelOpen,
  archivedOutputs,
  onToggleArchivePanel,
  onTriggerFileSelect,
  onOpenMediaLibrary,
  onRestoreArchivedOutput,
  onRestoreAllArchivedOutputs,
}: ReferenceGridArchiveControlsProps) {
  return (
    <>
      {showHeader ? (
        <div className="panel-header preview-header reference-all-refs-header">
          <div>
            <p className="eyebrow">Reference Grid</p>
          </div>
          <div className="preview-header-actions">
            <button
              type="button"
              className="ghost-btn mini preview-media-btn reference-grid-add-files-btn"
              onClick={onTriggerFileSelect}
            >
              <UploadSimple size={14} weight="regular" />
              <span>Add files</span>
            </button>
            <PromptLibraryButton
              onClick={(event) => {
                event.preventDefault();
                onOpenMediaLibrary?.();
              }}
              className="prompt-media-btn preview-media-btn reference-grid-media-library-btn"
              aria-label="Open media library"
              label="Media Library"
              icon={<CloudArrowUp size={16} weight="regular" aria-hidden />}
              tone="library"
            />
            {archiveCount > 0 ? (
              <button
                type="button"
                className="ghost-btn mini preview-media-btn reference-archive-btn"
                onClick={onToggleArchivePanel}
                aria-expanded={isArchivePanelOpen}
              >
                Archived ({archiveCount})
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!showHeader && archiveCount > 0 ? (
        <div className="reference-archive-inline">
          <button
            type="button"
            className="ghost-btn mini preview-media-btn reference-archive-btn"
            onClick={onToggleArchivePanel}
            aria-expanded={isArchivePanelOpen}
          >
            Archived ({archiveCount})
          </button>
          {onRestoreAllArchivedOutputs ? (
            <button
              type="button"
              className="ghost-btn mini preview-media-btn reference-archive-restore-all-btn"
              onClick={() => onRestoreAllArchivedOutputs()}
            >
              Restore all
            </button>
          ) : null}
        </div>
      ) : null}

      {isArchivePanelOpen && archiveCount > 0 ? (
        <div className="reference-archive-panel" aria-label="Archived references">
          <div className="reference-archive-header">
            <p className="tiny subdued">
              Older references are archived to keep the grid responsive.
            </p>
            <button
              type="button"
              className="ghost-btn mini preview-media-btn reference-archive-restore-all-btn"
              onClick={() => onRestoreAllArchivedOutputs?.()}
            >
              Restore all
            </button>
          </div>
          <div className="reference-archive-list">
            {archivedOutputs.slice(0, 24).map((item) => (
              <div key={item.id} className="reference-archive-item">
                <span className="reference-archive-item-label">
                  {item.previewText ? item.previewText : item.prompt}
                </span>
                <button
                  type="button"
                  className="ghost-btn mini reference-archive-item-restore"
                  onClick={() => onRestoreArchivedOutput?.(item.id)}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * @deprecated Use `ReferenceGridArchiveControls`.
 */
export type ReferenceCanvasArchiveControlsProps = ReferenceGridArchiveControlsProps;

/**
 * @deprecated Use `ReferenceGridArchiveControls`.
 */
export const ReferenceCanvasArchiveControls = ReferenceGridArchiveControls;
