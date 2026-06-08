import React from "react";
import { CloudArrowUp, UploadSimple } from "phosphor-react";
import type { StudioOutput } from "../../types";
import { REFERENCE_GRID_MAX_VISIBLE_ITEMS } from "../logic/referenceGridLimits";

type ReferenceGridArchiveControlsProps = {
  archiveCount: number;
  visibleItemCount: number;
  showHeader: boolean;
  showTitle?: boolean;
  showTopTitleDivider?: boolean;
  isArchivePanelOpen: boolean;
  archivedOutputs: StudioOutput[];
  hideUploadActions?: boolean;
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
  visibleItemCount,
  showHeader,
  showTitle = true,
  showTopTitleDivider = false,
  isArchivePanelOpen,
  archivedOutputs,
  hideUploadActions = false,
  onToggleArchivePanel,
  onTriggerFileSelect,
  onOpenMediaLibrary,
  onRestoreArchivedOutput,
  onRestoreAllArchivedOutputs,
}: ReferenceGridArchiveControlsProps) {
  return (
    <>
      {showHeader ? (
        <div
          className={`panel-header preview-header reference-all-refs-header${
            !showTitle ? " is-title-hidden" : ""
          }`}
        >
          <div className="reference-all-refs-header-meta">
            <p className="tiny subdued reference-all-refs-count">
              Media: {visibleItemCount}/{REFERENCE_GRID_MAX_VISIBLE_ITEMS}
            </p>
            <div
              className={`reference-all-refs-title-wrap${
                showTopTitleDivider && showTitle ? " is-top-section-header" : ""
              }`}
            >
              {showTitle ? <p className="eyebrow">Reference Grid</p> : null}
              {showTopTitleDivider && showTitle ? (
                <span className="reference-section-title-divider" aria-hidden="true" />
              ) : null}
            </div>
          </div>
          <div className="preview-header-actions">
            {!hideUploadActions ? (
              <>
                <button
                  type="button"
                  className="ghost-btn mini preview-media-btn reference-grid-add-files-btn"
                  onClick={onTriggerFileSelect}
                >
                  <UploadSimple size={14} weight="regular" />
                  <span>Add files</span>
                </button>
                {onOpenMediaLibrary ? (
                  <button
                    type="button"
                    className="ghost-btn mini preview-media-btn reference-grid-media-library-btn"
                    onClick={onOpenMediaLibrary}
                  >
                    <CloudArrowUp size={14} weight="regular" />
                    <span>Media Library</span>
                  </button>
                ) : null}
              </>
            ) : null}
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
