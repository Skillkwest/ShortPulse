import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceAudioPlayer } from "../ReferenceAudioPlayer";
import { __resetExclusiveSoundPlaybackForTests } from "../exclusiveSoundPlayback";

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
    __resetExclusiveSoundPlaybackForTests();
    extractAudioWaveformPeaksFromUrlMock.mockResolvedValue([20, 40, 60]);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });

  afterEach(() => {
    __resetExclusiveSoundPlaybackForTests();
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

  it("does not preload audio metadata when duration is already known", () => {
    render(
      <ReferenceAudioPlayer
        audioId="audio-known-duration"
        audioUrl="https://signed.test/known-duration.mp3"
        durationMs={12_000}
        playLabel="Play audio"
        pauseLabel="Pause audio"
      />
    );

    expect(document.querySelector("audio")?.getAttribute("preload")).toBe("none");
  });

  it("can defer audio metadata preload for pressure-sensitive surfaces", () => {
    render(
      <ReferenceAudioPlayer
        audioId="audio-deferred-metadata"
        audioUrl="https://signed.test/deferred-metadata.mp3"
        preloadAudioMetadata={false}
        playLabel="Play audio"
        pauseLabel="Pause audio"
      />
    );

    expect(document.querySelector("audio")?.getAttribute("preload")).toBe("none");
  });

  it("can hide the duration badge without changing duration metadata", () => {
    const { rerender } = render(
      <ReferenceAudioPlayer
        audioId="audio-visible-duration"
        audioUrl="https://signed.test/visible-duration.mp3"
        durationMs={12_000}
        playLabel="Play audio"
        pauseLabel="Pause audio"
      />
    );

    expect(screen.getByText("0:12")).toBeInTheDocument();

    rerender(
      <ReferenceAudioPlayer
        audioId="audio-hidden-duration"
        audioUrl="https://signed.test/hidden-duration.mp3"
        durationMs={12_000}
        showDurationBadge={false}
        playLabel="Play audio"
        pauseLabel="Pause audio"
      />
    );

    expect(screen.queryByText("0:12")).toBeNull();
    expect(document.querySelector("audio")?.getAttribute("preload")).toBe("none");
  });

  it("does not render a zero duration badge while duration is unknown", () => {
    render(
      <ReferenceAudioPlayer
        audioId="audio-unknown-duration"
        audioUrl="https://signed.test/unknown-duration.mp3"
        playLabel="Play audio"
        pauseLabel="Pause audio"
      />
    );

    expect(screen.queryByText("0:00")).toBeNull();
    expect(document.querySelector("audio")?.getAttribute("preload")).toBe("metadata");
  });

  it("only reserves title space for the in-card download button when that button is rendered", () => {
    const { rerender } = render(
      <ReferenceAudioPlayer
        audioId="audio-title-no-download"
        audioUrl="https://signed.test/title.mp3"
        title="Ember A Horse"
        playLabel="Play audio"
        pauseLabel="Pause audio"
      />
    );

    expect(document.querySelector(".reference-card-audio-title")).toHaveTextContent(
      "Ember A Horse"
    );
    expect(document.querySelector(".reference-card-audio-shell")).not.toHaveClass(
      "has-audio-download"
    );

    rerender(
      <ReferenceAudioPlayer
        audioId="audio-title-with-download"
        audioUrl="https://signed.test/title.mp3"
        title="Ember A Horse"
        playLabel="Play audio"
        pauseLabel="Pause audio"
        onDownload={vi.fn()}
      />
    );

    expect(document.querySelector(".reference-card-audio-shell")).toHaveClass("has-audio-download");
    expect(screen.getByLabelText("Download audio")).toBeInTheDocument();
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

  it("falls back to the provided audio URL when fresh resolution is unavailable", async () => {
    const resolveAudioUrl = vi.fn(async () => "");

    render(
      <ReferenceAudioPlayer
        audioId="audio-fallback"
        audioUrl="https://signed.test/existing-playback.mp3"
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
    expect(document.querySelector("audio")?.getAttribute("src")).toBe(
      "https://signed.test/existing-playback.mp3"
    );
  });

  it("pre-resolves a fresh signed URL so the click path can play synchronously", async () => {
    const resolveAudioUrl = vi.fn(async () => "https://signed.test/pre-resolved-audio.mp3");

    render(
      <ReferenceAudioPlayer
        audioId="audio-3"
        audioUrl="https://signed.test/stale-pre-resolved.mp3"
        playLabel="Play audio"
        pauseLabel="Pause audio"
        onResolveAudioUrl={resolveAudioUrl}
        resolveAudioUrlOnMount
      />
    );

    const audio = document.querySelector("audio");
    await waitFor(() => {
      expect(audio?.getAttribute("src")).toBe("https://signed.test/pre-resolved-audio.mp3");
    });
    expect(resolveAudioUrl).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });
    expect(resolveAudioUrl).toHaveBeenCalledTimes(1);
  });

  it("starts playback on pointer down and suppresses the follow-up click", async () => {
    const resolveAudioUrl = vi.fn(async () => "https://signed.test/pointer-audio.mp3");

    render(
      <ReferenceAudioPlayer
        audioId="audio-pointer"
        audioUrl="https://signed.test/stale-pointer.mp3"
        playLabel="Play audio"
        pauseLabel="Pause audio"
        onResolveAudioUrl={resolveAudioUrl}
        resolveAudioUrlOnMount
      />
    );

    const audio = document.querySelector("audio");
    await waitFor(() => {
      expect(audio?.getAttribute("src")).toBe("https://signed.test/pointer-audio.mp3");
    });

    const playButton = screen.getByRole("button", { name: "Play audio" });
    fireEvent.pointerDown(playButton, { button: 0 });
    fireEvent.click(playButton);

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });
    expect(resolveAudioUrl).toHaveBeenCalledTimes(1);
  });

  it("keeps a pre-resolved URL when the resolver callback identity changes", async () => {
    const firstResolver = vi.fn(async () => "https://signed.test/stable-audio.mp3");
    const secondResolver = vi.fn(async () => "https://signed.test/should-not-resign.mp3");
    const props = {
      audioId: "audio-stable-resolver",
      audioUrl: "https://signed.test/stale-stable.mp3",
      playLabel: "Play audio",
      pauseLabel: "Pause audio",
      resolveAudioUrlOnMount: true,
    };

    const { rerender } = render(
      <ReferenceAudioPlayer {...props} onResolveAudioUrl={firstResolver} />
    );

    const audio = document.querySelector("audio");
    await waitFor(() => {
      expect(audio?.getAttribute("src")).toBe("https://signed.test/stable-audio.mp3");
    });

    rerender(<ReferenceAudioPlayer {...props} onResolveAudioUrl={secondResolver} />);

    expect(audio?.getAttribute("src")).toBe("https://signed.test/stable-audio.mp3");
    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });
    expect(firstResolver).toHaveBeenCalledTimes(1);
    expect(secondResolver).not.toHaveBeenCalled();
    expect(audio?.getAttribute("src")).toBe("https://signed.test/stable-audio.mp3");
  });

  it("mirrors active playback state for another player with the same audio asset", async () => {
    render(
      <>
        <ReferenceAudioPlayer
          audioId="audio-card"
          audioAssetKey="studio-output:shared-audio"
          audioUrl="https://signed.test/shared-audio.mp3"
          playLabel="Play card audio"
          pauseLabel="Pause card audio"
        />
        <ReferenceAudioPlayer
          audioId="audio-modal"
          audioAssetKey="studio-output:shared-audio"
          audioUrl="https://signed.test/shared-audio.mp3"
          playLabel="Play modal audio"
          pauseLabel="Pause modal audio"
        />
      </>
    );

    const [cardAudio] = Array.from(document.querySelectorAll("audio"));
    Object.defineProperty(cardAudio, "duration", { configurable: true, value: 20 });
    Object.defineProperty(cardAudio, "currentTime", {
      configurable: true,
      writable: true,
      value: 5,
    });

    fireEvent.click(screen.getByRole("button", { name: "Play card audio" }));
    fireEvent.play(cardAudio);
    fireEvent.timeUpdate(cardAudio);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause modal audio" })).toBeInTheDocument();
    });
    expect(screen.getAllByRole("slider", { name: "Audio seek position" })[1]).toHaveAttribute(
      "aria-valuenow",
      "25"
    );
  });

  it("pauses the active same-asset owner from a mirrored player", async () => {
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause");
    render(
      <>
        <ReferenceAudioPlayer
          audioId="audio-card"
          audioAssetKey="studio-output:shared-audio"
          audioUrl="https://signed.test/shared-audio.mp3"
          playLabel="Play card audio"
          pauseLabel="Pause card audio"
        />
        <ReferenceAudioPlayer
          audioId="audio-modal"
          audioAssetKey="studio-output:shared-audio"
          audioUrl="https://signed.test/shared-audio.mp3"
          playLabel="Play modal audio"
          pauseLabel="Pause modal audio"
        />
      </>
    );

    const [cardAudio] = Array.from(document.querySelectorAll("audio"));
    Object.defineProperty(cardAudio, "duration", { configurable: true, value: 20 });
    Object.defineProperty(cardAudio, "currentTime", {
      configurable: true,
      writable: true,
      value: 5,
    });

    fireEvent.click(screen.getByRole("button", { name: "Play card audio" }));
    fireEvent.play(cardAudio);
    fireEvent.timeUpdate(cardAudio);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause modal audio" })).toBeInTheDocument();
    });

    pauseSpy.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Pause modal audio" }));

    expect(pauseSpy).toHaveBeenCalled();
  });
});
