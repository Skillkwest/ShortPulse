import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaLibraryWorkspaceContent } from "../MediaLibraryWorkspaceContent";

describe("MediaLibraryWorkspaceContent", () => {
  it("renders ordered workspace sections from grouped props", () => {
    render(
      <MediaLibraryWorkspaceContent
        filtersRowProps={{
          activeTab: "uploaded_images",
          countLabel: "files",
          search: "",
          visibleCount: 5,
          onSearchChange: vi.fn(),
          onSelectTab: vi.fn(),
        }}
        gallerySectionProps={{
          activeMediaQuery: "",
          activeMediaTab: "uploaded_images",
          activeTab: "uploaded_images",
          adaptivePressureLevel: 0,
          adaptivePreviewQualityEnabled: false,
          allVisibleSelected: false,
          aspectMap: {},
          bulkDeleting: false,
          bulkMoveError: null,
          bulkMoveMenuOpen: false,
          bulkMoveNotice: null,
          bulkMoveTabOptions: [],
          bulkMoving: false,
          canBulkMove: true,
          deleteButtonLabel: "Delete selected",
          deleteItemLabel: "files",
          files: [],
          formatDate: (value: string) => value,
          getMediaCardRef: () => () => {},
          handleImageLoad: vi.fn(),
          handleMediaPreviewError: vi.fn(),
          handleVideoMeta: vi.fn(),
          hasMoreMediaPages: false,
          isPromptTab: false,
          isVideoFile: (fileType: string) => fileType.startsWith("video/"),
          loadMoreSentinelRef: createRef<HTMLDivElement>(),
          loading: true,
          loadingMoreMedia: false,
          onClearSelection: vi.fn(),
          onDeletePrompt: vi.fn(async () => true),
          onDownloadFile: vi.fn(async () => {}),
          onFetchMediaTabPage: vi.fn(async () => {}),
          onMoveSelected: vi.fn(),
          onOpenFileModal: vi.fn(),
          onOpenPromptModal: vi.fn(),
          onRequestDeleteFile: vi.fn(),
          onRequestDeleteSelected: vi.fn(),
          onSelectAllVisible: vi.fn(),
          onToggleBulkMoveMenu: vi.fn(),
          onToggleFileSelect: vi.fn(),
          onTogglePromptSelect: vi.fn(),
          prompts: [],
          selectedIds: [],
          selectedMediaRowsCount: 0,
          selectableIdsCount: 0,
        }}
        headerProps={{
          planLabel: "Current plan",
          planName: "Free",
          storageUsageValue: "50.0 MB / 1.0 GB",
          storageCapacityValue: "1.0 GB",
        }}
        uploadStageProps={{
          activeTab: "uploaded_images",
          error: null,
          fileInputRef: createRef<HTMLInputElement | null>(),
          isDragging: false,
          planLimitBytes: 1024 * 1024 * 1024,
          selectedFiles: [],
          totalBytes: 50 * 1024 * 1024,
          uploadCount: 0,
          uploading: false,
          onDragLeave: vi.fn(),
          onDragOver: vi.fn(),
          onDrop: vi.fn(),
          onFileChange: vi.fn(),
          onTriggerFilePicker: vi.fn(),
          onOpenBilling: vi.fn(),
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Media Library" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Loading media…")).toBeInTheDocument();
  });
});
