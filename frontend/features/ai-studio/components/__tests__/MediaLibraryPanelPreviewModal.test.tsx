import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaFileRow } from "../../logic/mediaLibraryModalModel";
import { MediaLibraryPanelPreviewModal } from "../media-library-modal/MediaLibraryPanelPreviewModal";
import { ReferenceAudioPlayer } from "../shared/ReferenceAudioPlayer";
import { __resetExclusiveSoundPlaybackForTests } from "../shared/exclusiveSoundPlayback";

describe("MediaLibraryPanelPreviewModal", () => {
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

  it("pauses an existing inline audio preview when modal audio starts playing", () => {
    const pauseSpy = HTMLMediaElement.prototype.pause as ReturnType<typeof vi.fn>;
    const audioFile: MediaFileRow = {
      id: "audio-1",
      filename: "voice-note-1.mp3",
      storage_path: "user-1/uploads/voice-note-1.mp3",
      preview_storage_path: "user-1/uploads/voice-note-1.mp3",
      file_type: "audio/mpeg",
      signedUrl: "https://cdn.example.com/voice-note-1.mp3",
    };

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
        <MediaLibraryPanelPreviewModal
          file={audioFile}
          previewUrl="https://cdn.example.com/voice-note-1.mp3"
          isLoading={false}
          error={null}
          onClose={vi.fn()}
        />
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: "Play reference audio" }));
    const referenceAudioNode = document.querySelector(
      ".reference-card-audio"
    ) as HTMLAudioElement | null;
    const modalAudioNode = document.querySelector(
      ".media-library-panel-preview-media"
    ) as HTMLAudioElement | null;

    expect(referenceAudioNode).not.toBeNull();
    expect(modalAudioNode).not.toBeNull();

    fireEvent.play(referenceAudioNode as HTMLAudioElement);
    pauseSpy.mockClear();

    fireEvent.play(modalAudioNode as HTMLAudioElement);

    expect(pauseSpy).toHaveBeenCalledTimes(1);
  });

  it("renders an available image preview while the focused asset is still loading", () => {
    const imageFile: MediaFileRow = {
      id: "image-1",
      filename: "portrait.png",
      storage_path: "user-1/uploads/portrait.png",
      preview_storage_path: "user-1/uploads/thumb-portrait.png",
      file_type: "image/png",
      signedUrl: "https://cdn.example.com/thumb-portrait.png",
    };

    render(
      <MediaLibraryPanelPreviewModal
        file={imageFile}
        previewUrl="https://cdn.example.com/thumb-portrait.png"
        isLoading
        error={null}
        onClose={vi.fn()}
      />
    );

    const image = screen.getByAltText("portrait.png") as HTMLImageElement;
    expect(image).toBeInTheDocument();
    expect(image.getAttribute("src")).toBe("https://cdn.example.com/thumb-portrait.png");
    expect(screen.queryByText("Loading preview…")).not.toBeInTheDocument();
  });

  it("moves image preview failures into controlled unavailable UI", () => {
    const onPreviewError = vi.fn();
    const imageFile: MediaFileRow = {
      id: "image-1",
      filename: "portrait.png",
      storage_path: "user-1/uploads/portrait.png",
      preview_storage_path: "user-1/uploads/thumb-portrait.png",
      file_type: "image/png",
      signedUrl: "https://cdn.example.com/thumb-portrait.png",
    };

    render(
      <MediaLibraryPanelPreviewModal
        file={imageFile}
        previewUrl="https://cdn.example.com/thumb-portrait.png"
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onPreviewError={onPreviewError}
      />
    );

    const image = screen.getByAltText("portrait.png") as HTMLImageElement;
    fireEvent.error(image);

    expect(onPreviewError).toHaveBeenCalledWith(
      imageFile,
      "https://cdn.example.com/thumb-portrait.png"
    );
    expect(screen.queryByAltText("portrait.png")).not.toBeInTheDocument();
    expect(screen.getByText("Preview unavailable.")).toBeInTheDocument();
  });

  it("does not render transform or optimizer image urls as focused preview media", () => {
    const imageFile: MediaFileRow = {
      id: "image-1",
      filename: "portrait.png",
      storage_path: "user-1/uploads/portrait.png",
      preview_storage_path: "user-1/uploads/thumb-portrait.png",
      file_type: "image/png",
      signedUrl: null,
    };

    const { rerender } = render(
      <MediaLibraryPanelPreviewModal
        file={imageFile}
        previewUrl="https://project.supabase.co/storage/v1/render/image/sign/media_library/user-1/image.png?token=abc&width=320&quality=28"
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByAltText("portrait.png")).not.toBeInTheDocument();
    expect(screen.getByText("Preview unavailable.")).toBeInTheDocument();

    rerender(
      <MediaLibraryPanelPreviewModal
        file={imageFile}
        previewUrl="/_next/image?url=https%3A%2F%2Fcdn.example.com%2Fsmall.jpg&w=384&q=28"
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByAltText("portrait.png")).not.toBeInTheDocument();
    expect(screen.getByText("Preview unavailable.")).toBeInTheDocument();
  });
});
