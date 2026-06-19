/**
 * Shared-detail modal wrapper for AI Studio Media Library panel media cards.
 * Renders the canonical media detail layout for saved library items without triggering
 * Reference Grid ingest side effects on open.
 */
import React from "react";
import { FlowArrow, TrashSimple } from "phosphor-react";
import type { MediaLibraryDetailModalItem } from "../../logic/mediaLibraryDetailModal";
import { canReloadMediaLibraryWorkflow } from "../../logic/mediaLibraryWorkflowReload";
import { SharedMediaDetailPreviewModal } from "../detail-modal/SharedMediaDetailPreviewModal";
import type {
  SharedMediaDetailVideoSnapshotErrorHandler,
  SharedMediaDetailVideoSnapshotHandler,
} from "../detail-modal/detailModalPlatformTypes";
import { resolveSharedMediaDetailMediaActionItems } from "../detail-modal/sharedMediaDetailActions";

type MediaLibraryPanelPreviewModalProps = {
  item: MediaLibraryDetailModalItem | null;
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

/**
 * Renders a modal preview for a selected media card.
 * Inputs: selected file row, resolved preview URL, loading/error state, and close callback.
 * Output: modal markup when `file` is set.
 * Side effects: closes on Escape key.
 */
export function MediaLibraryPanelPreviewModal({
  item,
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
        saveState: "saved",
        canDownload: item.capabilities.canDownload,
        onDownload: onDownloadItem ? () => onDownloadItem(item) : null,
        canDelete: item.capabilities.canDelete,
        onDelete: onDeleteItem ? () => onDeleteItem(item) : null,
        deleteIcon: <TrashSimple size={16} weight="bold" aria-hidden />,
      }),
    ];
  }, [handleReloadWorkflowItem, item, onDeleteItem, onDownloadItem, onReloadWorkflowItem]);

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
