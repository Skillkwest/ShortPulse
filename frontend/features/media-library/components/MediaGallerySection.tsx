/**
 * Gallery section for Media Library.
 * Orchestrates gallery actions plus loading/empty states and prompt-vs-media grid rendering.
 */
import type { Ref, SyntheticEvent } from "react";
import type { MediaMoveDestination } from "../logic/mediaMoveRouting";
import type { MediaDataTab } from "../logic/mediaLibraryPageHelpers";
import { MediaAssetGallery } from "./MediaAssetGallery";
import { MediaGalleryActions } from "./MediaGalleryActions";
import { MediaPromptGrid } from "./MediaPromptGrid";

type MediaGalleryTab =
  | "uploaded_images"
  | "uploaded_videos"
  | "private"
  | "saved_prompts"
  | "ai_generations";

type MediaGalleryFileRow = {
  id: string;
  filename: string;
  file_type: string;
  signedUrl?: string;
  status?: "uploading" | "ready";
};

type MediaGalleryPromptRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: string;
  created_at: string;
};

type BulkMoveOption = {
  tab: MediaMoveDestination;
  label: string;
  disabled: boolean;
  reason?: string;
};

type MediaCardRefCallback = (node: HTMLDivElement | null) => void;

export type MediaGallerySectionProps<
  TFileRow extends MediaGalleryFileRow,
  TPromptRow extends MediaGalleryPromptRow,
> = {
  activeMediaQuery: string;
  activeMediaTab: MediaDataTab | null;
  activeTab: MediaGalleryTab;
  adaptivePressureLevel: 0 | 1 | 2;
  adaptivePreviewQualityEnabled: boolean;
  allVisibleSelected: boolean;
  aspectMap: Record<string, number>;
  bulkDeleting: boolean;
  bulkMoveError: string | null;
  bulkMoveMenuOpen: boolean;
  bulkMoveNotice: string | null;
  bulkMoveTabOptions: BulkMoveOption[];
  bulkMoving: boolean;
  canBulkMove: boolean;
  deleteButtonLabel: string;
  deleteItemLabel: string;
  files: TFileRow[];
  formatDate: (value: string) => string;
  getMediaCardRef: (fileId: string) => MediaCardRefCallback;
  handleImageLoad: (id: string, event: SyntheticEvent<HTMLImageElement>) => void;
  handleMediaPreviewError: (row: TFileRow) => void;
  handleVideoMeta: (id: string, event: SyntheticEvent<HTMLVideoElement>) => void;
  hasMoreMediaPages: boolean;
  isPromptTab: boolean;
  isVideoFile: (fileType: string) => boolean;
  loadMoreSentinelRef: Ref<HTMLDivElement>;
  loading: boolean;
  loadingMoreMedia: boolean;
  onClearSelection: () => void;
  onDeletePrompt: (row: TPromptRow) => Promise<boolean>;
  onDownloadFile: (row: TFileRow) => Promise<void>;
  onFetchMediaTabPage: (
    tab: MediaDataTab,
    options?: { reset?: boolean; query?: string }
  ) => Promise<void>;
  onMoveSelected: (destinationTab: MediaMoveDestination) => void;
  onOpenFileModal: (file: TFileRow) => void;
  onOpenPromptModal: (prompt: TPromptRow) => void;
  onRequestDeleteFile: (file: TFileRow) => void;
  onRequestDeleteSelected: () => void;
  onSelectAllVisible: () => void;
  onToggleBulkMoveMenu: () => void;
  onToggleFileSelect: (file: TFileRow) => void;
  onTogglePromptSelect: (promptId: string) => void;
  prompts: TPromptRow[];
  selectedIds: string[];
  selectedMediaRowsCount: number;
  selectableIdsCount: number;
};

const resolveEmptyMediaMessage = (activeTab: MediaGalleryTab): string => {
  if (activeTab === "uploaded_images") return "No images uploaded yet.";
  if (activeTab === "uploaded_videos") return "No videos uploaded yet.";
  if (activeTab === "private") return "No private images uploaded yet.";
  return "No AI Studio generations saved yet.";
};

/**
 * Renders the media gallery section shell and content state branches.
 * Inputs: gallery action state, prompt/media rows, and row-level interaction handlers.
 * Output: complete gallery section markup for Media Library.
 * Side effects: none.
 */
export function MediaGallerySection<
  TFileRow extends MediaGalleryFileRow,
  TPromptRow extends MediaGalleryPromptRow,
>({
  activeMediaQuery,
  activeMediaTab,
  activeTab,
  adaptivePressureLevel,
  adaptivePreviewQualityEnabled,
  allVisibleSelected,
  aspectMap,
  bulkDeleting,
  bulkMoveError,
  bulkMoveMenuOpen,
  bulkMoveNotice,
  bulkMoveTabOptions,
  bulkMoving,
  canBulkMove,
  deleteButtonLabel,
  deleteItemLabel,
  files,
  formatDate,
  getMediaCardRef,
  handleImageLoad,
  handleMediaPreviewError,
  handleVideoMeta,
  hasMoreMediaPages,
  isPromptTab,
  isVideoFile,
  loadMoreSentinelRef,
  loading,
  loadingMoreMedia,
  onClearSelection,
  onDeletePrompt,
  onDownloadFile,
  onFetchMediaTabPage,
  onMoveSelected,
  onOpenFileModal,
  onOpenPromptModal,
  onRequestDeleteFile,
  onRequestDeleteSelected,
  onSelectAllVisible,
  onToggleBulkMoveMenu,
  onToggleFileSelect,
  onTogglePromptSelect,
  prompts,
  selectedIds,
  selectedMediaRowsCount,
  selectableIdsCount,
}: MediaGallerySectionProps<TFileRow, TPromptRow>) {
  return (
    <section
      className={`panel media-gallery media-panel ${isPromptTab ? "" : "media-gallery-packed"}`}
    >
      <MediaGalleryActions
        activeTab={activeTab}
        allVisibleSelected={allVisibleSelected}
        bulkDeleting={bulkDeleting}
        bulkMoveError={bulkMoveError}
        bulkMoveMenuOpen={bulkMoveMenuOpen}
        bulkMoveNotice={bulkMoveNotice}
        bulkMoveTabOptions={bulkMoveTabOptions}
        bulkMoving={bulkMoving}
        canBulkMove={canBulkMove}
        deleteButtonLabel={deleteButtonLabel}
        deleteItemLabel={deleteItemLabel}
        isPromptTab={isPromptTab}
        onClearSelection={onClearSelection}
        onMoveSelected={onMoveSelected}
        onRequestDeleteSelected={onRequestDeleteSelected}
        onSelectAllVisible={onSelectAllVisible}
        onToggleBulkMoveMenu={onToggleBulkMoveMenu}
        selectedIdsCount={selectedIds.length}
        selectedMediaRowsCount={selectedMediaRowsCount}
        selectableIdsCount={selectableIdsCount}
      />
      {loading ? <div className="subdued tiny">Loading media…</div> : null}
      {!loading && isPromptTab && !prompts.length ? (
        <div className="subdued tiny">No prompts saved yet.</div>
      ) : null}
      {!loading && !isPromptTab && !files.length ? (
        <div className="subdued tiny">{resolveEmptyMediaMessage(activeTab)}</div>
      ) : null}
      {isPromptTab ? (
        <MediaPromptGrid
          deletePrompt={onDeletePrompt}
          formatDate={formatDate}
          openPromptModal={onOpenPromptModal}
          prompts={prompts}
          selectedIds={selectedIds}
          togglePromptSelect={onTogglePromptSelect}
        />
      ) : (
        <MediaAssetGallery
          activeMediaQuery={activeMediaQuery}
          activeMediaTab={activeMediaTab}
          adaptivePressureLevel={adaptivePressureLevel}
          adaptivePreviewQualityEnabled={adaptivePreviewQualityEnabled}
          aspectMap={aspectMap}
          downloadFile={onDownloadFile}
          fetchMediaTabPage={onFetchMediaTabPage}
          files={files}
          getMediaCardRef={getMediaCardRef}
          handleImageLoad={handleImageLoad}
          handleMediaPreviewError={handleMediaPreviewError}
          handleVideoMeta={handleVideoMeta}
          hasMoreMediaPages={hasMoreMediaPages}
          isVideoFile={isVideoFile}
          loadMoreSentinelRef={loadMoreSentinelRef}
          loadingMoreMedia={loadingMoreMedia}
          openModal={onOpenFileModal}
          requestDeleteFile={onRequestDeleteFile}
          selectedIds={selectedIds}
          toggleSelect={onToggleFileSelect}
        />
      )}
    </section>
  );
}
