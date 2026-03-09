import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaGallerySection } from "../MediaGallerySection";

type MediaFileRow = {
  id: string;
  filename: string;
  file_type: string;
  signedUrl?: string;
  status?: "uploading" | "ready";
};

type MediaPromptRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: string;
  created_at: string;
};

const buildBaseProps = () => ({
  activeMediaQuery: "",
  activeMediaTab: "uploaded_images" as const,
  activeTab: "uploaded_images" as const,
  adaptivePressureLevel: 0 as const,
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
  files: [] as MediaFileRow[],
  formatDate: (value: string) => value,
  getMediaCardRef: () => () => {},
  handleImageLoad: vi.fn(),
  handleMediaPreviewError: vi.fn(),
  handleVideoMeta: vi.fn(),
  hasMoreMediaPages: false,
  isPromptTab: false,
  isVideoFile: (fileType: string) => fileType.startsWith("video/"),
  loadMoreSentinelRef: createRef<HTMLDivElement>(),
  loading: false,
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
  prompts: [] as MediaPromptRow[],
  selectedIds: [],
  selectedMediaRowsCount: 0,
  selectableIdsCount: 2,
});

describe("MediaGallerySection", () => {
  it("renders loading status and selection action controls", () => {
    const props = buildBaseProps();

    render(<MediaGallerySection {...props} loading />);

    expect(screen.getByText("Loading media…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(props.onSelectAllVisible).toHaveBeenCalledTimes(1);
  });

  it("renders prompt-empty state on saved prompts tab", () => {
    render(
      <MediaGallerySection
        {...buildBaseProps()}
        activeTab="saved_prompts"
        isPromptTab
        deleteItemLabel="prompts"
      />
    );

    expect(screen.getByText("No prompts saved yet.")).toBeInTheDocument();
  });

  it("renders media-empty message for private tab", () => {
    render(<MediaGallerySection {...buildBaseProps()} activeTab="private" />);

    expect(screen.getByText("No private images uploaded yet.")).toBeInTheDocument();
  });
});
