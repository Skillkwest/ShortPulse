/**
 * Shared-detail modal wrapper for AI Studio Media Library panel media cards.
 * Renders the canonical media detail layout for saved library items without triggering
 * Reference Grid ingest side effects on open.
 */
import React from "react";
import { FlowArrow, TrashSimple } from "phosphor-react";
import type {
  MediaLibraryDetailModalItem,
  MediaLibraryDetailNavigationContract,
} from "../../logic/mediaLibraryDetailModal";
import {
  canReloadMediaLibraryWorkflow,
  createMediaLibraryWorkflowReloadOutput,
} from "../../logic/mediaLibraryWorkflowReload";
import { DetailModal } from "../DetailModal";
import { SharedMediaDetailPreviewModal } from "../detail-modal/SharedMediaDetailPreviewModal";
import type {
  SharedMediaDetailVideoSnapshotErrorHandler,
  SharedMediaDetailVideoSnapshotHandler,
} from "../detail-modal/detailModalPlatformTypes";
import { resolveSharedMediaDetailMediaActionItems } from "../detail-modal/sharedMediaDetailActions";

type MediaLibraryPanelPreviewModalProps = {
  item: MediaLibraryDetailModalItem | null;
  detailNavigation?: MediaLibraryDetailNavigationContract | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onPreviewError?: (item: MediaLibraryDetailModalItem, failedUrl: string) => void;
  onSnapshotVideoFrame?: SharedMediaDetailVideoSnapshotHandler;
  onSnapshotVideoFrameError?: SharedMediaDetailVideoSnapshotErrorHandler;
  onReloadWorkflowItem?: (item: MediaLibraryDetailModalItem) => void;
  onDownloadItem?: (item: MediaLibraryDetailModalItem) => void;
  onDeleteItem?: (item: MediaLibraryDetailModalItem) => void;
};

const shouldIgnoreMediaLibraryDetailNavigationKeyEvent = (event: KeyboardEvent): boolean => {
  if (event.defaultPrevented) return true;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  if (["input", "textarea", "select", "audio", "video"].includes(tagName)) return true;
  return Boolean(
    target.closest(
      "input, textarea, select, audio, video, [contenteditable='true'], [role='textbox'], [role='slider']"
    )
  );
};

/**
 * Renders a modal preview for a selected media card.
 * Inputs: selected file row, resolved preview URL, loading/error state, and close callback.
 * Output: modal markup when `file` is set.
 * Side effects: closes on Escape key.
 */
export function MediaLibraryPanelPreviewModal({
  item,
  detailNavigation = null,
  isLoading,
  error,
  onClose,
  onPreviewError,
  onSnapshotVideoFrame,
  onSnapshotVideoFrameError,
  onReloadWorkflowItem,
  onDownloadItem,
  onDeleteItem,
}: MediaLibraryPanelPreviewModalProps) {
  const generatedDetailOutput = React.useMemo(
    () => (item ? createMediaLibraryWorkflowReloadOutput(item.file) : null),
    [item]
  );
  const handlePreviewError = React.useCallback(
    (sharedItem: MediaLibraryDetailModalItem | null, failedUrl: string) => {
      if (!sharedItem) return;
      onPreviewError?.(sharedItem, failedUrl);
    },
    [onPreviewError]
  );
  const handleReloadWorkflowItem = React.useCallback(
    (nextItem: MediaLibraryDetailModalItem) => {
      onReloadWorkflowItem?.(nextItem);
      onClose();
    },
    [onClose, onReloadWorkflowItem]
  );
  React.useEffect(() => {
    if (!item || !detailNavigation || typeof document === "undefined") return;
    const handleDetailNavigationKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreMediaLibraryDetailNavigationKeyEvent(event)) return;
      if (event.key === "ArrowLeft") {
        if (!detailNavigation.canNavigatePrevious) return;
        event.preventDefault();
        detailNavigation.onNavigatePrevious();
        return;
      }
      if (event.key === "ArrowRight") {
        if (!detailNavigation.canNavigateNext) return;
        event.preventDefault();
        detailNavigation.onNavigateNext();
      }
    };
    document.addEventListener("keydown", handleDetailNavigationKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDetailNavigationKeyDown);
    };
  }, [detailNavigation, item]);
  const topBarActionItems = React.useMemo(() => {
    if (!item) return [];
    return [
      ...(onReloadWorkflowItem && canReloadMediaLibraryWorkflow(item.file)
        ? [
            {
              id: "reload-workflow",
              label: "",
              ariaLabel: "Reload workflow",
              title: "Reload workflow",
              onClick: () => handleReloadWorkflowItem(item),
              icon: <FlowArrow size={16} weight="bold" aria-hidden />,
              className: "is-icon-only",
            },
          ]
        : []),
      ...resolveSharedMediaDetailMediaActionItems({
        canDownload: item.capabilities.canDownload,
        onDownload: onDownloadItem ? () => onDownloadItem(item) : null,
        canDelete: item.capabilities.canDelete,
        onDelete: onDeleteItem ? () => onDeleteItem(item) : null,
        deleteIcon: <TrashSimple size={16} weight="bold" aria-hidden />,
      }),
    ];
  }, [handleReloadWorkflowItem, item, onDeleteItem, onDownloadItem, onReloadWorkflowItem]);

  if (item && generatedDetailOutput) {
    return (
      <DetailModal
        output={generatedDetailOutput}
        context={null}
        onClose={onClose}
        onUpdatePrompt={() => undefined}
        onDeleteOutput={() => {
          onDeleteItem?.(item);
        }}
        onDownloadReference={() => {
          onDownloadItem?.(item);
        }}
        onReloadWorkflowReference={
          onReloadWorkflowItem
            ? () => {
                onReloadWorkflowItem(item);
              }
            : undefined
        }
        onSnapshotVideoFrame={onSnapshotVideoFrame}
        onSnapshotVideoFrameError={onSnapshotVideoFrameError}
      />
    );
  }

  return (
    <SharedMediaDetailPreviewModal
      item={item}
      isLoading={isLoading}
      error={error}
      onClose={onClose}
      onPreviewError={(sharedItem, failedUrl) =>
        handlePreviewError(sharedItem as MediaLibraryDetailModalItem | null, failedUrl)
      }
      onSnapshotVideoFrame={onSnapshotVideoFrame}
      onSnapshotVideoFrameError={onSnapshotVideoFrameError}
      topBarActionItems={topBarActionItems}
      modalActivityId="media-library-panel-preview-modal"
      backdropClassName="reference-modal-backdrop media-library-panel-preview-backdrop"
      backdropDataTestId="media-library-panel-preview-backdrop"
      closeLabel="Close media preview"
      stageClassName="art-image-vessel media-library-panel-preview-body"
      placeholderClassName="art-text-placeholder media-library-panel-preview-placeholder"
      imageClassName="art-hero-image media-library-panel-preview-media"
      videoClassName="art-hero-image media-library-panel-preview-media"
      audioClassName="art-hero-audio media-library-panel-preview-media"
    />
  );
}
