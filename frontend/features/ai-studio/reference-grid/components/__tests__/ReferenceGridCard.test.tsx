import type React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPLICIT_CONTENT_FAILURE_DETAIL,
  EXPLICIT_CONTENT_FAILURE_TITLE,
} from "../../../../../lib/explicitContentFailure";
import type { StudioOutput } from "../../../types";
import { ReferenceGridCard } from "../ReferenceGridCard";

const playMock = vi.fn();
const pauseMock = vi.fn();

beforeAll(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => {
    playMock();
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {
    pauseMock();
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.useFakeTimers();
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

    fireEvent.pointerEnter(card);
    expect(playMock).toHaveBeenCalled();

    fireEvent.pointerLeave(card);
    expect(pauseMock).toHaveBeenCalled();
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
    expect(container.querySelector(".reference-spinner")).not.toBeNull();
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
});
