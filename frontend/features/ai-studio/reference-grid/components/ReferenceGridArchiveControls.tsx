import React from "react";
import { UploadSimple } from "phosphor-react";
import type { StudioOutput } from "../../types";
import {
  REFERENCE_GRID_MAX_VISIBLE_ITEMS,
  REFERENCE_GRID_WARN_VISIBLE_ITEMS,
} from "../logic/referenceGridLimits";

type ReferenceGridArchiveControlsProps = {
  archiveCount: number;
  visibleItemCount: number;
  showHeader: boolean;
  showTitle?: boolean;
  showTopTitleDivider?: boolean;
  isArchivePanelOpen: boolean;
  archivedOutputs: StudioOutput[];
  hideUploadActions?: boolean;
  showHoverHelper?: boolean;
  onToggleArchivePanel: () => void;
  onTriggerFileSelect?: () => void;
  onRestoreArchivedOutput?: (id: string) => void;
  onRestoreAllArchivedOutputs?: () => void;
};

/**
 * Shared header controls for all-refs and split-grid surfaces.
 */
export function ReferenceGridArchiveControls({
  visibleItemCount,
  showHeader,
  showTitle = true,
  showTopTitleDivider = false,
  hideUploadActions = false,
  showHoverHelper = false,
  onTriggerFileSelect,
}: ReferenceGridArchiveControlsProps) {
  const isNearActiveWorksetLimit = visibleItemCount >= REFERENCE_GRID_WARN_VISIBLE_ITEMS;

  return (
    <>
      {showHeader ? (
        <div
          className={`panel-header preview-header reference-all-refs-header${
            !showTitle ? " is-title-hidden" : ""
          }`}
        >
          <div className="reference-all-refs-header-meta">
            <p
              className={`tiny subdued reference-all-refs-count${
                isNearActiveWorksetLimit ? " is-near-active-workset-limit" : ""
              }`}
              title={
                isNearActiveWorksetLimit
                  ? "Reference Grid is nearing the active workset limit."
                  : undefined
              }
            >
              Media: {visibleItemCount}/{REFERENCE_GRID_MAX_VISIBLE_ITEMS}
            </p>
            <p
              className={`tiny reference-grid-hover-helper${showHoverHelper ? " is-visible" : ""}`}
              aria-hidden="true"
            >
              Double-click a reference to view details.
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
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
