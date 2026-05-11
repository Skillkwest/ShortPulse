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
});
