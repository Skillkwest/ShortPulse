import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaLibraryModalStack } from "../MediaLibraryModalStack";

type MediaFileRow = {
  id: string;
  filename: string;
  file_type: string;
  signedUrl?: string;
};

type MediaPromptRow = {
  id: string;
};

const buildFileModal = () => ({
  canMoveToAnotherTab: true,
  cacheModalImageNaturalSize: vi.fn(),
  cacheAspectRatio: vi.fn(),
  closeModal: vi.fn(),
  downloadFile: vi.fn(async () => {}),
  focusedAspectRatio: 4 / 5,
  focusedFile: null as MediaFileRow | null,
  handleMediaPreviewError: vi.fn(),
  handleModalImageClick: vi.fn(),
  handleModalImageKeyDown: vi.fn(),
  handleModalImagePointerDown: vi.fn(),
  handleModalImagePointerMove: vi.fn(),
  handleModalImagePointerUp: vi.fn(),
  handleModalImageWheel: vi.fn(),
  handleModalPreviewWheel: vi.fn(),
  handleRenameInputChange: vi.fn(),
  isModalImagePanning: false,
  isVideoFile: (fileType: string) => fileType.startsWith("video/"),
  modalError: null as string | null,
  modalImagePan: { x: 0, y: 0 },
  modalImageZoomActive: false,
  modalImageZoomScale: 1,
  modalMoveTabOptions: [{ tab: "private" as const, label: "Private", disabled: false }],
  modalPreviewRef: createRef<HTMLDivElement>(),
  moveError: null as string | null,
  moveFocusedFile: vi.fn(async () => {}),
  moveMenuOpen: false,
  movingFile: false,
  renameSuccess: false,
  renameValue: "file.png",
  requestDeleteFile: vi.fn(),
  saveRename: vi.fn(async () => {}),
  savingRename: false,
  setMoveMenuOpen: vi.fn(),
});

const buildPromptModal = () => ({
  closePromptModal: vi.fn(),
  deletePrompt: vi.fn(async () => true),
  focusedPrompt: null as MediaPromptRow | null,
  handlePromptEditChange: vi.fn(),
  promptEditValue: "draft",
  promptModalError: null as string | null,
  promptSaveSuccess: false,
  savePromptEdits: vi.fn(async () => {}),
  savingPromptEdit: false,
});

const buildProps = () => ({
  bulkDeleting: false,
  confirmDeleteIds: null as string[] | null,
  deleteTarget: null as { filename: string } | null,
  deletingSingle: false,
  fileModal: buildFileModal(),
  onCancelDeleteFile: vi.fn(),
  onCancelDeleteSelected: vi.fn(),
  onConfirmDeleteFile: vi.fn(async () => {}),
  onConfirmDeleteSelected: vi.fn(async () => {}),
  promptModal: buildPromptModal(),
});

describe("MediaLibraryModalStack", () => {
  it("renders single-file delete confirm and delegates actions", () => {
    const props = buildProps();
    props.deleteTarget = { filename: "one.png" };

    render(<MediaLibraryModalStack {...props} />);

    expect(screen.getByText("Delete this file from your library?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete file" }));
    expect(props.onCancelDeleteFile).toHaveBeenCalledTimes(1);
    expect(props.onConfirmDeleteFile).toHaveBeenCalledTimes(1);
  });

  it("renders selected-files delete confirm with count", () => {
    const props = buildProps();
    props.confirmDeleteIds = ["a", "b", "c"];

    render(<MediaLibraryModalStack {...props} />);

    expect(screen.getByText("Delete selected file(s) from your library?")).toBeInTheDocument();
    expect(screen.getByText(/3 selected file\(s\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete selected" }));
    expect(props.onConfirmDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it("renders focused-file modal when a file is focused", () => {
    const props = buildProps();
    props.fileModal.focusedFile = {
      id: "file-1",
      filename: "first.png",
      file_type: "image/png",
      signedUrl: "https://signed/first.png",
    };

    render(<MediaLibraryModalStack {...props} />);

    expect(screen.getByLabelText("Enter new filename")).toBeInTheDocument();
  });

  it("renders focused-prompt modal when a prompt is focused", () => {
    const props = buildProps();
    props.promptModal.focusedPrompt = { id: "prompt-1" };

    render(<MediaLibraryModalStack {...props} />);

    expect(screen.getByPlaceholderText("Edit your prompt...")).toBeInTheDocument();
  });
});
