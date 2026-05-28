import type React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPLICIT_CONTENT_FAILURE_DETAIL,
  EXPLICIT_CONTENT_FAILURE_TITLE,
} from "../../../../../lib/explicitContentFailure";
import { resolveRequiredAudioMusicModelId } from "../../../../../lib/model-runtime/modelCatalog";
import type { StudioOutput } from "../../../types";
import { __resetExclusiveSoundPlaybackForTests } from "../../../components/shared/exclusiveSoundPlayback";
import { ReferenceGridCard } from "../ReferenceGridCard";

const playMock = vi.fn();
const pauseMock = vi.fn();
const loadMock = vi.fn();

beforeAll(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => {
    playMock();
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {
    pauseMock();
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {
    loadMock();
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.useFakeTimers();
  __resetExclusiveSoundPlaybackForTests();
  playMock.mockClear();
  pauseMock.mockClear();
  loadMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "Prompt",
  mode: "image",
  aspect: "9:16",
  model: "Model",
  status: "ready",
  timestamp: "Now",
  taskState: "fail",
  ...overrides,
});

const createProps = (
  overrides: Partial<React.ComponentProps<typeof ReferenceGridCard>> = {}
): React.ComponentProps<typeof ReferenceGridCard> => ({
  item: createOutput(),
  authorityTier: "reusable",
  dragSourceSurface: "all-refs",
  videoNodeKey: "video-node-key",
  activeOutputId: null,
  isLoading: false,
  loadingVisual: "none",
  cardPreviewUrl: null,
  isVideoPreview: false,
  isImagePreview: false,
  canAutoplayVideo: false,
  videoPreload: "none",
  isPromptOnly: false,
  isLinkedPromptReference: false,
  canRetryStatus: false,
  imageSrc: undefined,
  imageLoading: "lazy",
  imageFetchPriority: "low",
  onSelectOutput: vi.fn(),
  onOpenDetails: vi.fn(),
  onCardDragStart: vi.fn(),
  onCardDragEnd: vi.fn(),
  registerVideoNode: vi.fn(),
  markLoaded: vi.fn(),
  onAutoplayStarted: vi.fn(),
  onAutoplayStopped: vi.fn(),
  ...overrides,
});

describe("ReferenceGridCard", () => {
  it("starts and stops video playback on hover", async () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({ mode: "video" }),
          isVideoPreview: true,
          cardPreviewUrl: "https://example.com/video.mp4",
          canAutoplayVideo: false,
          videoPreload: "metadata",
        })}
      />
    );

    const card = screen.getByRole("button");
    const videoNode = document.querySelector(".reference-card-video") as HTMLVideoElement | null;
    const videoSource = videoNode?.querySelector("source");

    expect(videoNode?.draggable).toBe(false);
    expect(videoNode?.getAttribute("src")).toBe("https://example.com/video.mp4");
    expect(videoSource?.getAttribute("src")).toBe("https://example.com/video.mp4");

    fireEvent.pointerEnter(card);
    expect(playMock).toHaveBeenCalled();

    fireEvent.pointerLeave(card);
    expect(pauseMock).toHaveBeenCalled();
  });

  it("starts video playback from mouse hover fallback", async () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({ mode: "video" }),
          isVideoPreview: true,
          cardPreviewUrl: "https://example.com/video.mp4",
          canAutoplayVideo: false,
          videoPreload: "metadata",
        })}
      />
    );

    fireEvent.mouseEnter(screen.getByRole("button"));

    expect(loadMock).toHaveBeenCalled();
    expect(playMock).toHaveBeenCalled();
  });

  it("renders a video duration badge when duration metadata is available", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({ mode: "video", durationMs: 6_000 }),
          isVideoPreview: true,
          cardPreviewUrl: "https://example.com/video.mp4",
          canAutoplayVideo: false,
          videoPreload: "metadata",
        })}
      />
    );

    expect(screen.getByText("0:06")).toBeInTheDocument();
  });

  it("shows an NSFW pill for provider safety failures", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            errorMessage: "Generation failed",
            errorMessageShort: "Content not allowed",
            errorDetail:
              "The model did not generate the expected output for this prompt because it was flagged as unsafe content.",
          }),
        })}
      />
    );

    expect(screen.getByText("NSFW")).toBeInTheDocument();
    expect(screen.getByText(EXPLICIT_CONTENT_FAILURE_TITLE)).toBeInTheDocument();
    expect(screen.getByText(EXPLICIT_CONTENT_FAILURE_DETAIL)).toBeInTheDocument();
  });

  it("does not show an NSFW pill for generic provider failures", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            errorMessage: "Downstream service error",
            errorMessageShort: "Generation failed",
            errorDetail: "Downstream service error",
          }),
        })}
      />
    );

    expect(screen.queryByText("NSFW")).toBeNull();
  });

  it("prefers detailed provider validation copy when the short failure label is generic", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            errorMessage: "Invalid request",
            errorMessageShort: "Generation failed",
            errorDetail: "text must be 2000 characters or fewer.",
          }),
        })}
      />
    );

    expect(screen.getByText("text must be 2000 characters or fewer.")).toBeInTheDocument();
    expect(screen.queryByText("Generation failed", { selector: ".fail-subtitle" })).toBeNull();
  });

  it("normalizes raw JSON validation detail before rendering the failure subtitle", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            errorMessage: "Invalid request",
            errorMessageShort: "Generation failed",
            errorDetail: '{"detail":[{"loc":["prompt"],"msg":"Field required","type":"missing"}]}',
          }),
        })}
      />
    );

    expect(screen.getByText("Prompt is required.")).toBeInTheDocument();
    expect(screen.queryByText('{"detail"', { exact: false })).toBeNull();
  });

  it("renders a loading spinner overlay when the card is loading", () => {
    const { container } = render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({ mode: "video", taskState: "success" }),
          isLoading: true,
          loadingVisual: "spinner",
          isVideoPreview: true,
          cardPreviewUrl: "blob:local-video-1",
        })}
      />
    );

    expect(container.querySelector(".reference-loading")).not.toBeNull();
    expect(container.querySelector(".reference-loading--spinner")).not.toBeNull();
    expect(container.querySelector(".reference-spinner")).not.toBeNull();
  });

  it("clears a generation loading placeholder from the grid", () => {
    const onClearGenerationOutput = vi.fn();

    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({ taskState: "running" }),
          isLoading: true,
          loadingVisual: "spinner",
          onClearGenerationOutput,
        })}
      />
    );

    fireEvent.click(screen.getByLabelText("Clear generation from grid"));

    expect(onClearGenerationOutput).toHaveBeenCalledWith("out-1");
  });

  it("keeps placeholder clear pointer events from reaching parent surfaces", () => {
    const onClearGenerationOutput = vi.fn();
    const onParentPointerDown = vi.fn();

    render(
      <div onPointerDown={onParentPointerDown}>
        <ReferenceGridCard
          {...createProps({
            item: createOutput({ taskState: "running" }),
            isLoading: true,
            loadingVisual: "spinner",
            onClearGenerationOutput,
          })}
        />
      </div>
    );

    const clearButton = screen.getByLabelText("Clear generation from grid");
    fireEvent.pointerDown(clearButton);
    fireEvent.click(clearButton);

    expect(onParentPointerDown).not.toHaveBeenCalled();
    expect(onClearGenerationOutput).toHaveBeenCalledWith("out-1");
  });

  it("marks hydrating image previews as loaded after the fallback timeout", async () => {
    const markLoaded = vi.fn();

    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            taskState: "success",
            previewUrl: "https://example.com/hydrating.png",
          }),
          isLoading: true,
          loadingVisual: "hydrating",
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/hydrating.png",
          imageSrc: "https://example.com/hydrating.png",
          markLoaded,
        })}
      />
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(markLoaded).toHaveBeenCalledWith("out-1", { notifyAutoSave: false });
  });

  it("shows a controlled unavailable placeholder when an image preview fails", () => {
    const markLoaded = vi.fn();
    const { container } = render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            taskState: "success",
            previewUrl: "https://example.com/broken.png",
          }),
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/broken.png",
          imageSrc: "https://example.com/broken.png",
          markLoaded,
        })}
      />
    );

    const image = container.querySelector(
      ".reference-card-image--cover"
    ) as HTMLImageElement | null;
    expect(image).not.toBeNull();

    fireEvent.error(image as HTMLImageElement);

    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
    expect(container.querySelector(".reference-card-image")).toBeNull();
    expect(markLoaded).toHaveBeenCalledWith("out-1", { notifyAutoSave: false });
  });

  it("hides the poster image on hover for poster-backed videos", async () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            mode: "video",
            previewPosterUrl: "data:image/jpeg;base64,poster",
            localObjectUrl: "blob:local-video-1",
          }),
          videoPosterUrl: "data:image/jpeg;base64,poster",
          hoverVideoUrl: "blob:local-video-1",
          isVideoPreview: false,
          isImagePreview: false,
          cardPreviewUrl: "blob:local-video-1#video=1",
          canAutoplayVideo: false,
          videoPreload: "none",
        })}
      />
    );

    const card = screen.getByRole("button");
    const posterImage = document.querySelector(
      ".reference-card-image--poster"
    ) as HTMLImageElement | null;
    const videoNode = document.querySelector(".reference-card-video") as HTMLVideoElement | null;

    expect(posterImage).not.toBeNull();
    expect(videoNode).not.toBeNull();
    expect(videoNode?.classList.contains("is-visible")).toBe(false);
    expect(posterImage?.classList.contains("is-hidden")).toBe(false);

    fireEvent.pointerEnter(card);
    expect(playMock).toHaveBeenCalled();
    expect(videoNode?.classList.contains("is-visible")).toBe(true);
    expect(posterImage?.classList.contains("is-hidden")).toBe(true);

    fireEvent.pointerLeave(card);
    expect(pauseMock).toHaveBeenCalled();
    expect(posterImage?.classList.contains("is-hidden")).toBe(false);
  });

  it("renders a video poster even when hover playback is unavailable", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            mode: "video",
            previewPosterUrl: "https://signed.test/poster_720.jpg",
            mediaSource: "generated",
          }),
          videoPosterUrl: "https://signed.test/poster_720.jpg",
          hoverVideoUrl: null,
          isVideoPreview: false,
          isImagePreview: false,
          cardPreviewUrl: null,
          canAutoplayVideo: false,
          videoPreload: "none",
        })}
      />
    );

    const card = screen.getByRole("button");
    const posterImage = document.querySelector(
      ".reference-card-image--poster"
    ) as HTMLImageElement | null;
    const videoNode = document.querySelector(".reference-card-video") as HTMLVideoElement | null;

    expect(card).toHaveClass("has-preview", "has-video", "has-video-poster");
    expect(posterImage).not.toBeNull();
    expect(posterImage?.getAttribute("src")).toBe("https://signed.test/poster_720.jpg");
    expect(videoNode).toBeNull();
  });

  it("falls back to the hover video when a poster-backed video image fails to load", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            mode: "video",
            previewPosterUrl: "https://signed.test/poster_720.jpg",
            mediaSource: "generated",
          }),
          videoPosterUrl: "https://signed.test/poster_720.jpg",
          hoverVideoUrl: "https://signed.test/video-full.mp4",
          isVideoPreview: false,
          isImagePreview: false,
          cardPreviewUrl: "https://signed.test/video-full.mp4",
          canAutoplayVideo: false,
          videoPreload: "none",
        })}
      />
    );

    const posterImage = document.querySelector(
      ".reference-card-image--poster"
    ) as HTMLImageElement | null;
    const videoNode = document.querySelector(".reference-card-video") as HTMLVideoElement | null;

    expect(posterImage).not.toBeNull();
    expect(videoNode).not.toBeNull();
    expect(videoNode?.classList.contains("is-visible")).toBe(false);

    fireEvent.error(posterImage!);

    expect(document.querySelector(".reference-card-image--poster")).toBeNull();
    expect(videoNode?.classList.contains("is-visible")).toBe(true);
    expect(videoNode?.getAttribute("src")).toBe("https://signed.test/video-full.mp4");
  });

  it("renders a compact audio preview with timing and waveform", async () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            mode: "audio",
            taskState: "success",
            durationMs: 2000,
            modelId: resolveRequiredAudioMusicModelId(),
          }),
          isAudioPreview: true,
          cardPreviewUrl: "https://example.com/audio.mp3",
        })}
      />
    );

    const playButton = screen.getByRole("button", { name: "Play audio preview" });
    const audioNode = document.querySelector(".reference-card-audio") as HTMLAudioElement | null;
    const waveformBars = document.querySelectorAll(".reference-card-audio-wavebar");

    expect(audioNode).not.toBeNull();
    expect(document.querySelector(".reference-card-audio-time-row")).not.toBeNull();
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("0:02")).toBeInTheDocument();
    expect(document.querySelector('[data-media-duration-kind="music"]')).not.toBeNull();
    expect(waveformBars.length).toBeGreaterThan(10);
    expect(waveformBars.length).toBeLessThan(40);

    fireEvent.click(playButton);
    expect(playMock).toHaveBeenCalledTimes(1);

    fireEvent.play(audioNode as HTMLAudioElement);
    expect(screen.getByRole("button", { name: "Pause audio preview" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause audio preview" }));
    expect(pauseMock).toHaveBeenCalled();
  });

  it("pauses the previously active audio preview when another card starts playback", () => {
    const onRequestAudioPlay = vi.fn();
    const onAudioPlaybackStopped = vi.fn();

    render(
      <>
        <ReferenceGridCard
          {...createProps({
            item: createOutput({ id: "audio-1", mode: "audio", taskState: "success" }),
            audioInstanceKey: "all-refs:audio-1",
            isAudioPreview: true,
            cardPreviewUrl: "https://example.com/audio-1.mp3",
            onRequestAudioPlay,
            onAudioPlaybackStopped,
          })}
        />
        <ReferenceGridCard
          {...createProps({
            item: createOutput({ id: "audio-2", mode: "audio", taskState: "success" }),
            audioInstanceKey: "all-refs:audio-2",
            isAudioPreview: true,
            cardPreviewUrl: "https://example.com/audio-2.mp3",
            onRequestAudioPlay,
            onAudioPlaybackStopped,
          })}
        />
      </>
    );

    const playButtons = screen.getAllByRole("button", { name: "Play audio preview" });

    fireEvent.click(playButtons[0] as HTMLButtonElement);
    fireEvent.click(playButtons[1] as HTMLButtonElement);

    expect(onRequestAudioPlay).toHaveBeenCalledTimes(2);
    expect(onRequestAudioPlay).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ instanceKey: "all-refs:audio-1", pause: expect.any(Function) })
    );
    expect(onRequestAudioPlay).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ instanceKey: "all-refs:audio-2", pause: expect.any(Function) })
    );
  });

  it("does not open details when the audio play control is double-clicked", () => {
    const onOpenDetails = vi.fn();

    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({ mode: "audio", taskState: "success" }),
          isAudioPreview: true,
          cardPreviewUrl: "https://example.com/audio.mp3",
          onOpenDetails,
        })}
      />
    );

    fireEvent.doubleClick(screen.getByRole("button", { name: "Play audio preview" }));

    expect(onOpenDetails).not.toHaveBeenCalled();
  });

  it("fills waveform bars as audio playback progresses", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({ mode: "audio", taskState: "success", durationMs: 4000 }),
          isAudioPreview: true,
          cardPreviewUrl: "https://example.com/audio-progress.mp3",
        })}
      />
    );

    const audioNode = document.querySelector(".reference-card-audio") as HTMLAudioElement | null;
    expect(audioNode).not.toBeNull();

    Object.defineProperty(audioNode, "duration", {
      configurable: true,
      value: 4,
    });
    Object.defineProperty(audioNode, "currentTime", {
      configurable: true,
      writable: true,
      value: 2.1,
    });

    fireEvent.timeUpdate(audioNode as HTMLAudioElement);

    const playedBars = document.querySelectorAll(
      '.reference-card-audio-wavebar[data-progress-state="played"]'
    );
    const playingBar = document.querySelector(
      '.reference-card-audio-wavebar[data-progress-state="playing"]'
    );

    expect(playedBars.length).toBeGreaterThan(0);
    expect(playingBar).not.toBeNull();
  });

  it("keeps fallback waveform density fixed across audio durations", () => {
    const { rerender } = render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({ mode: "audio", taskState: "success", durationMs: 2000 }),
          isAudioPreview: true,
          cardPreviewUrl: "https://example.com/audio-short.mp3",
        })}
      />
    );

    expect(document.querySelectorAll(".reference-card-audio-wavebar").length).toBeGreaterThan(10);
    expect(document.querySelectorAll(".reference-card-audio-wavebar").length).toBeLessThan(40);

    rerender(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            id: "out-2",
            mode: "audio",
            taskState: "success",
            durationMs: 12000,
          }),
          isAudioPreview: true,
          cardPreviewUrl: "https://example.com/audio-long.mp3",
        })}
      />
    );

    expect(document.querySelectorAll(".reference-card-audio-wavebar").length).toBeGreaterThan(10);
    expect(document.querySelectorAll(".reference-card-audio-wavebar").length).toBeLessThan(40);
  });

  it("prefers stored waveform peaks when they exist on the audio output", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            mode: "audio",
            taskState: "success",
            durationMs: 4000,
            waveformPeaks: [10, 20, 30, 40, 50],
          }),
          isAudioPreview: true,
          cardPreviewUrl: "https://example.com/audio-with-peaks.mp3",
        })}
      />
    );

    const waveformBars = Array.from(
      document.querySelectorAll(".reference-card-audio-wavebar")
    ) as HTMLSpanElement[];
    expect(waveformBars.length).toBeGreaterThan(10);
    expect(waveformBars.length).toBeLessThan(40);
    expect(
      waveformBars.some(
        (bar) => Number.parseFloat(bar.style.getPropertyValue("--audio-waveform-height")) > 0.25
      )
    ).toBe(true);
  });
});
