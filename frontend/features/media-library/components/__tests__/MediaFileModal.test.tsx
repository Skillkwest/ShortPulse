import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaFileModal } from "../MediaFileModal";

describe("MediaFileModal", () => {
  it("wires move and rename actions to provided handlers", async () => {
    const closeModal = vi.fn();
    const downloadFile = vi.fn(async () => {});
    const requestDeleteFile = vi.fn();
    const handleRenameInputChange = vi.fn();
    const saveRename = vi.fn(async () => {});
    const setMoveMenuOpen = vi.fn();
    const moveFocusedFile = vi.fn(async () => {});

    const { container } = render(
      <MediaFileModal
        canMoveToAnotherTab
        cacheModalImageNaturalSize={vi.fn()}
        cacheAspectRatio={vi.fn()}
        closeModal={closeModal}
        downloadFile={downloadFile}
        focusedAspectRatio={4 / 5}
        focusedFile={{
          id: "file-1",
          filename: "first.png",
          file_type: "image/png",
          signedUrl: "https://signed/first.png",
        }}
        handleMediaPreviewError={vi.fn()}
        handleModalImageClick={vi.fn()}
        handleModalImageKeyDown={vi.fn()}
        handleModalImagePointerDown={vi.fn()}
        handleModalImagePointerMove={vi.fn()}
        handleModalImagePointerUp={vi.fn()}
        handleModalImageWheel={vi.fn()}
        handleModalPreviewWheel={vi.fn()}
        handleRenameInputChange={handleRenameInputChange}
        isModalImagePanning={false}
        isVideoFile={(fileType) => fileType.startsWith("video/")}
        modalError={null}
        modalImagePan={{ x: 0, y: 0 }}
        modalImageZoomActive={false}
        modalImageZoomScale={1}
        modalMoveTabOptions={[{ tab: "private", label: "Private", disabled: false }]}
        modalPreviewRef={{ current: null }}
        moveError={null}
        moveFocusedFile={moveFocusedFile}
        moveMenuOpen
        movingFile={false}
        renameSuccess={false}
        renameValue="first.png"
        requestDeleteFile={requestDeleteFile}
        saveRename={saveRename}
        savingRename={false}
        setMoveMenuOpen={setMoveMenuOpen}
      />
    );

    fireEvent.change(screen.getByLabelText("Enter new filename"), {
      target: { value: "renamed.png" },
    });
    expect(handleRenameInputChange).toHaveBeenCalledWith("renamed.png");

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(saveRename).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("menuitem", { name: "Private" }));
    expect(moveFocusedFile).toHaveBeenCalledWith("private");

    const backdrop = container.querySelector(".media-modal-backdrop");
    expect(backdrop).not.toBeNull();
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(closeModal).toHaveBeenCalled();
  });
});
