/**
 * Gallery action toolbar for Media Library.
 * Renders section headings, selection controls, bulk-move menu, and bulk-move feedback messaging.
 */
import { CaretDown } from "phosphor-react";
import { isMoveDestinationDataTab, type MediaMoveDestination } from "../logic/mediaMoveRouting";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";

type MediaGalleryTab =
  | "uploaded_images"
  | "uploaded_videos"
  | "private"
  | "saved_prompts"
  | "ai_generations";

type BulkMoveOption = {
  tab: MediaMoveDestination;
  label: string;
  disabled: boolean;
  reason?: string;
};

type MediaGalleryActionsProps = {
  activeTab: MediaGalleryTab;
  allVisibleSelected: boolean;
  bulkDeleting: boolean;
  bulkMoveError: string | null;
  bulkMoveMenuOpen: boolean;
  bulkMoveNotice: string | null;
  bulkMoveTabOptions: BulkMoveOption[];
  bulkMoving: boolean;
  canBulkMove: boolean;
  deleteButtonLabel: string;
  deleteItemLabel: string;
  isPromptTab: boolean;
  onClearSelection: () => void;
  onMoveSelected: (destinationTab: MediaMoveDestination) => void;
  onRequestDeleteSelected: () => void;
  onSelectAllVisible: () => void;
  onToggleBulkMoveMenu: () => void;
  selectedIdsCount: number;
  selectedMediaRowsCount: number;
  selectableIdsCount: number;
};

const resolveHeading = (activeTab: MediaGalleryTab): { eyebrow: string; title: string } => {
  switch (activeTab) {
    case "uploaded_images":
      return { eyebrow: "Uploaded images", title: "Your uploaded images" };
    case "uploaded_videos":
      return { eyebrow: "Uploaded videos", title: "Your uploaded videos" };
    case "private":
      return { eyebrow: "Private images", title: "Your private images" };
    case "saved_prompts":
      return { eyebrow: "Saved prompts", title: "Your saved prompts" };
    default:
      return { eyebrow: "AI Studio generations", title: "AI Studio generations" };
  }
};

/**
 * Renders gallery header actions and bulk move feedback.
 * Inputs: selection/move state and callbacks for action controls.
 * Output: action toolbar and optional status/error messaging.
 * Side effects: none.
 */
export function MediaGalleryActions({
  activeTab,
  allVisibleSelected,
  bulkDeleting,
  bulkMoveError,
  bulkMoveMenuOpen,
  bulkMoveNotice,
  bulkMoveTabOptions,
  bulkMoving,
  canBulkMove,
  deleteButtonLabel,
  deleteItemLabel,
  isPromptTab,
  onClearSelection,
  onMoveSelected,
  onRequestDeleteSelected,
  onSelectAllVisible,
  onToggleBulkMoveMenu,
  selectedIdsCount,
  selectedMediaRowsCount,
  selectableIdsCount,
}: MediaGalleryActionsProps) {
  const heading = resolveHeading(activeTab);

  useVisibleErrorTelemetry({
    source: "client.media_library.bulk_move_error",
    scope: "app",
    severity: "medium",
    message: bulkMoveError,
    metadata: {
      active_tab: activeTab,
      selected_ids_count: selectedIdsCount,
      selected_media_count: selectedMediaRowsCount,
    },
  });

  return (
    <>
      <div className="gallery-actions">
        <div className="section-heading minimal">
          <div>
            <p className="eyebrow">{heading.eyebrow}</p>
            <h3>{heading.title}</h3>
          </div>
        </div>
        <div className="gallery-btns">
          {selectedIdsCount ? (
            <button type="button" className="btn-secondary" onClick={onClearSelection}>
              Deselect all
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary"
            onClick={onSelectAllVisible}
            disabled={!selectableIdsCount || allVisibleSelected || bulkMoving}
          >
            Select all
          </button>
          {!isPromptTab ? (
            <div className="gallery-move">
              <button
                type="button"
                className="btn-secondary gallery-move-toggle"
                onClick={onToggleBulkMoveMenu}
                disabled={!selectedMediaRowsCount || !canBulkMove || bulkDeleting || bulkMoving}
                aria-haspopup="menu"
                aria-expanded={bulkMoveMenuOpen}
              >
                <span>{bulkMoving ? "Moving..." : "Move selected"}</span>
                <CaretDown
                  size={14}
                  weight="bold"
                  className={bulkMoveMenuOpen ? "is-open" : ""}
                  aria-hidden
                />
              </button>
              {bulkMoveMenuOpen ? (
                <div className="gallery-move-menu" role="menu" aria-label="Move selected media">
                  {bulkMoveTabOptions.map((option) => {
                    const label = option.reason
                      ? `${option.label} · ${option.reason}`
                      : option.label;
                    return (
                      <button
                        key={option.tab}
                        type="button"
                        className="gallery-move-option"
                        role="menuitem"
                        disabled={
                          option.disabled || !isMoveDestinationDataTab(option.tab) || bulkMoving
                        }
                        onClick={() => {
                          if (option.disabled || !isMoveDestinationDataTab(option.tab)) return;
                          onMoveSelected(option.tab);
                        }}
                        title={label}
                      >
                        <span>{option.label}</span>
                        {option.reason ? <small>{option.reason}</small> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className="btn-danger"
            onClick={onRequestDeleteSelected}
            disabled={!selectedIdsCount || bulkDeleting || bulkMoving}
            aria-label={`${deleteButtonLabel} ${selectedIdsCount} ${deleteItemLabel}`}
          >
            {bulkDeleting ? "Deleting..." : deleteButtonLabel}
          </button>
        </div>
      </div>
      {bulkMoveNotice && !isPromptTab ? (
        <div className="subdued tiny media-bulk-move-notice" role="status" aria-live="polite">
          {bulkMoveNotice}
        </div>
      ) : null}
      {bulkMoveError && !isPromptTab ? (
        <div className="auth-error media-bulk-move-error" role="alert" aria-live="assertive">
          {bulkMoveError}
        </div>
      ) : null}
    </>
  );
}
