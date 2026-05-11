import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceAudioPlayer } from "../../../ai-studio/components/shared/ReferenceAudioPlayer";
import { __resetExclusiveSoundPlaybackForTests } from "../../../ai-studio/components/shared/exclusiveSoundPlayback";
import { MediaFileModal } from "../MediaFileModal";

describe("MediaFileModal", () => {
  beforeEach(() => {
    __resetExclusiveSoundPlaybackForTests();
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("renders the provided signedUrl in detail preview", () => {
    const { container } = render(
      <MediaFileModal
        canMoveToAnotherTab
        cacheModalImageNaturalSize={vi.fn()}
        cacheAspectRatio={vi.fn()}
        closeModal={vi.fn()}
        downloadFile={vi.fn(async () => {})}
        focusedAspectRatio={4 / 5}
        focusedFile={{
          id: "file-1",
          filename: "first.png",
          file_type: "image/png",
          signedUrl: "https://signed/full-quality-first.png",
        }}
        handleMediaPreviewError={vi.fn()}
        handleModalImageClick={vi.fn()}
        handleModalImageKeyDown={vi.fn()}
        handleModalImagePointerDown={vi.fn()}
        handleModalImagePointerMove={vi.fn()}
        handleModalImagePointerUp={vi.fn()}
        handleModalImageWheel={vi.fn()}
        handleModalPreviewWheel={vi.fn()}
        handleRenameInputChange={vi.fn()}
        isModalImagePanning={false}
        isVideoFile={(fileType) => fileType.startsWith("video/")}
        modalError={null}
        modalImagePan={{ x: 0, y: 0 }}
        modalImageZoomActive={false}
        modalImageZoomScale={1}
        modalMoveTabOptions={[{ tab: "private", label: "Private", disabled: false }]}
        modalPreviewRef={{ current: null }}
        moveError={null}
        moveFocusedFile={vi.fn(async () => {})}
        moveMenuOpen={false}
        movingFile={false}
        renameSuccess={false}
        renameValue="first.png"
        requestDeleteFile={vi.fn()}
        saveRename={vi.fn(async () => {})}
        savingRename={false}
        setMoveMenuOpen={vi.fn()}
      />
    );

    const image = container.querySelector(".modal-zoomable-image") as HTMLImageElement | null;
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("https://signed/full-quality-first.png");
  });

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

  it("pauses an existing audio preview when modal video starts playing", () => {
    const pauseSpy = HTMLMediaElement.prototype.pause as ReturnType<typeof vi.fn>;

    render(
      <>
        <div className="reference-card has-audio">
          <ReferenceAudioPlayer
            audioId="ref-audio-1"
            audioUrl="https://example.com/ref-audio-1.mp3"
            playLabel="Play reference audio"
            pauseLabel="Pause reference audio"
          />
        </div>
        <MediaFileModal
          canMoveToAnotherTab
          cacheModalImageNaturalSize={vi.fn()}
          cacheAspectRatio={vi.fn()}
          closeModal={vi.fn()}
          downloadFile={vi.fn(async () => {})}
          focusedAspectRatio={16 / 9}
          focusedFile={{
            id: "video-1",
            filename: "clip.mp4",
            file_type: "video/mp4",
            signedUrl: "https://signed/clip.mp4",
          }}
          handleMediaPreviewError={vi.fn()}
          handleModalImageClick={vi.fn()}
          handleModalImageKeyDown={vi.fn()}
          handleModalImagePointerDown={vi.fn()}
          handleModalImagePointerMove={vi.fn()}
          handleModalImagePointerUp={vi.fn()}
          handleModalImageWheel={vi.fn()}
          handleModalPreviewWheel={vi.fn()}
          handleRenameInputChange={vi.fn()}
          isModalImagePanning={false}
          isVideoFile={(fileType) => fileType.startsWith("video/")}
          modalError={null}
          modalImagePan={{ x: 0, y: 0 }}
          modalImageZoomActive={false}
          modalImageZoomScale={1}
          modalMoveTabOptions={[{ tab: "private", label: "Private", disabled: false }]}
          modalPreviewRef={{ current: null }}
          moveError={null}
          moveFocusedFile={vi.fn(async () => {})}
          moveMenuOpen={false}
          movingFile={false}
          renameSuccess={false}
          renameValue="clip.mp4"
          requestDeleteFile={vi.fn()}
          saveRename={vi.fn(async () => {})}
          savingRename={false}
          setMoveMenuOpen={vi.fn()}
        />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: "Play reference audio" }));
    const referenceAudioNode = document.querySelector(".reference-card-audio") as HTMLAudioElement;
    const modalVideoNode = document.querySelector(".modal-preview video") as HTMLVideoElement;

    fireEvent.play(referenceAudioNode);
    pauseSpy.mockClear();

    fireEvent.play(modalVideoNode);

    expect(pauseSpy).toHaveBeenCalledTimes(1);
  });
});
