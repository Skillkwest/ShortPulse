import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceAudioPlayer } from "../ReferenceAudioPlayer";

const extractAudioWaveformPeaksFromUrlMock = vi.hoisted(() => vi.fn());

vi.mock("../../../reference-grid/logic/referenceGridAudioWaveform", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../reference-grid/logic/referenceGridAudioWaveform")
    >();
  return {
    ...actual,
    extractAudioWaveformPeaksFromUrl: (...args: unknown[]) =>
      extractAudioWaveformPeaksFromUrlMock(...args),
  };
});

describe("ReferenceAudioPlayer", () => {
  beforeEach(() => {
    extractAudioWaveformPeaksFromUrlMock.mockResolvedValue([20, 40, 60]);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    extractAudioWaveformPeaksFromUrlMock.mockReset();
  });

  it("does not decode waveform data on mount by default", async () => {
    render(
      <ReferenceAudioPlayer
        audioId="audio-lazy"
        audioUrl="https://signed.test/lazy-audio.mp3"
        playLabel="Play audio"
        pauseLabel="Pause audio"
      />
    );

    expect(extractAudioWaveformPeaksFromUrlMock).not.toHaveBeenCalled();
  });

  it("resolves a fresh signed URL before eager waveform decode", async () => {
    const resolveAudioUrl = vi.fn(async () => "https://signed.test/fresh-audio.mp3");

    render(
      <ReferenceAudioPlayer
        audioId="audio-1"
        audioUrl="https://signed.test/stale-audio.mp3"
        playLabel="Play audio"
        pauseLabel="Pause audio"
        eagerWaveformDecode
        onResolveAudioUrl={resolveAudioUrl}
      />
    );

    expect(document.querySelector("audio")?.getAttribute("src")).toBeNull();
    await waitFor(() => {
      expect(extractAudioWaveformPeaksFromUrlMock).toHaveBeenCalledWith(
        "https://signed.test/fresh-audio.mp3",
        expect.any(Number)
      );
    });
    expect(extractAudioWaveformPeaksFromUrlMock).not.toHaveBeenCalledWith(
      "https://signed.test/stale-audio.mp3",
      expect.any(Number)
    );
  });

  it("resolves a fresh signed URL before playback starts", async () => {
    const resolveAudioUrl = vi.fn(async () => "https://signed.test/fresh-playback.mp3");

    render(
      <ReferenceAudioPlayer
        audioId="audio-2"
        audioUrl="https://signed.test/stale-playback.mp3"
        playLabel="Play audio"
        pauseLabel="Pause audio"
        eagerWaveformDecode={false}
        onResolveAudioUrl={resolveAudioUrl}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });
    expect(resolveAudioUrl).toHaveBeenCalled();
    const audio = document.querySelector("audio");
    expect(audio?.getAttribute("src")).toBe("https://signed.test/fresh-playback.mp3");
  });
});
