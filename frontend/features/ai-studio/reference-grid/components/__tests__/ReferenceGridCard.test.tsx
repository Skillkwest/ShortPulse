import type React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPLICIT_CONTENT_FAILURE_DETAIL,
  EXPLICIT_CONTENT_FAILURE_TITLE,
} from "../../../../../lib/explicitContentFailure";
import { resolveRequiredAudioMusicModelId } from "../../../../../lib/model-runtime/modelCatalog";
import type { StudioOutput } from "../../../types";
import { AI_STUDIO_ERROR_SCENARIOS } from "../../../testing/errorScenarioFixtures";
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
  it("keeps prompt-only text references select-only on single click", () => {
    const onSelectOutput = vi.fn();
    const onOpenDetails = vi.fn();
    const textOutput = createOutput({
      id: "prompt-ref-1",
      prompt: "Prompt reference text",
      mode: "text",
      taskState: "success",
      previewText: "Prompt reference text",
      mediaSource: "prompt",
    });

    render(
      <ReferenceGridCard
        {...createProps({
          item: textOutput,
          isPromptOnly: true,
          onSelectOutput,
          onOpenDetails,
        })}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(onSelectOutput).toHaveBeenCalledWith("prompt-ref-1");
    expect(onOpenDetails).not.toHaveBeenCalled();
  });

  it("opens prompt-only text references in details on double click", () => {
    const onOpenDetails = vi.fn();
    const textOutput = createOutput({
      id: "prompt-ref-1",
      prompt: "Prompt reference text",
      mode: "text",
      taskState: "success",
      previewText: "Prompt reference text",
      mediaSource: "prompt",
    });

    render(
      <ReferenceGridCard
        {...createProps({
          item: textOutput,
          isPromptOnly: true,
          onOpenDetails,
        })}
      />
    );

    const card = screen.getByRole("button");
    fireEvent.click(card, { detail: 1 });
    fireEvent.click(card, { detail: 2 });
    fireEvent.doubleClick(card);

    expect(onOpenDetails).toHaveBeenCalledTimes(1);
    expect(onOpenDetails).toHaveBeenCalledWith("prompt-ref-1", textOutput);
  });

  it("keeps prompt-only text references select-only from keyboard activation", () => {
    const onSelectOutput = vi.fn();
    const onOpenDetails = vi.fn();
    const textOutput = createOutput({
      id: "prompt-ref-1",
      prompt: "Prompt reference text",
      mode: "text",
      taskState: "success",
      previewText: "Prompt reference text",
      mediaSource: "prompt",
    });

    render(
      <ReferenceGridCard
        {...createProps({
          item: textOutput,
          isPromptOnly: true,
          onSelectOutput,
          onOpenDetails,
        })}
      />
    );

    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });

    expect(onSelectOutput).toHaveBeenCalledWith("prompt-ref-1");
    expect(onOpenDetails).not.toHaveBeenCalled();
  });

  it("keeps media cards select-only on single click", () => {
    const onSelectOutput = vi.fn();
    const onOpenDetails = vi.fn();
    const imageOutput = createOutput({
      id: "image-ref-1",
      taskState: "success",
      previewUrl: "https://example.com/image.png",
    });

    render(
      <ReferenceGridCard
        {...createProps({
          item: imageOutput,
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/image.png",
          onSelectOutput,
          onOpenDetails,
        })}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(onSelectOutput).toHaveBeenCalledWith("image-ref-1");
    expect(onOpenDetails).not.toHaveBeenCalled();
  });

  it("keeps media cards opening details on double click", () => {
    const onOpenDetails = vi.fn();
    const imageOutput = createOutput({
      id: "image-ref-1",
      taskState: "success",
      previewUrl: "https://example.com/image.png",
    });

    render(
      <ReferenceGridCard
        {...createProps({
          item: imageOutput,
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/image.png",
          onOpenDetails,
        })}
      />
    );

    fireEvent.doubleClick(screen.getByRole("button"));

    expect(onOpenDetails).toHaveBeenCalledWith("image-ref-1", imageOutput);
  });

  it("opens failed error references in details on double click", () => {
    const onOpenDetails = vi.fn();
    const failedOutput = AI_STUDIO_ERROR_SCENARIOS[1]!.output;

    render(
      <ReferenceGridCard
        {...createProps({
          item: failedOutput,
          onOpenDetails,
        })}
      />
    );

    fireEvent.doubleClick(screen.getByRole("button"));

    expect(onOpenDetails).toHaveBeenCalledWith(failedOutput.id, failedOutput);
  });

  it("shows workflow reload for restorable generated references", () => {
    const onReloadWorkflowOutput = vi.fn();
    const onSelectOutput = vi.fn();
    const output = createOutput({
      taskState: "success",
      mediaSource: "generated",
      workflowReload: {
        version: 1,
        source: "ai_studio_generation",
        capturedAt: "2026-06-06T12:00:00.000Z",
        originTool: "create",
        panelKind: "create",
        outputMode: "image",
        restoreBehavior: "navigate_and_hydrate",
        createMode: "standard",
        pulse: null,
        prompt: { display: "Prompt" },
        model: { id: "fal-ai/bytedance/seedream/v4.5/text-to-image" },
        payload: {
          kind: "image",
          submitTool: "create",
          aspect: "9:16",
          imageResolution: "2K",
          referenceInputs: [],
        },
      },
    });

    render(
      <ReferenceGridCard
        {...createProps({
          item: output,
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/image.png",
          onReloadWorkflowOutput,
          onSelectOutput,
        })}
      />
    );

    fireEvent.click(screen.getByLabelText("Reload workflow"));

    expect(onSelectOutput).toHaveBeenCalledWith("out-1");
    expect(onReloadWorkflowOutput).toHaveBeenCalledWith(output, { mediaKindHint: "image" });
  });

  it("shows workflow reload for restorable generated video references", () => {
    const onReloadWorkflowOutput = vi.fn();
    const onSelectOutput = vi.fn();
    const output = createOutput({
      mode: "video",
      taskState: "success",
      mediaSource: "generated",
      workflowReload: {
        version: 1,
        source: "ai_studio_generation",
        capturedAt: "2026-06-06T12:00:00.000Z",
        originTool: "video",
        panelKind: "video",
        outputMode: "video",
        restoreBehavior: "navigate_and_hydrate",
        createMode: null,
        pulse: null,
        prompt: { display: "A cinematic tracking shot" },
        model: { id: "kie-ai/kling-3.0" },
        payload: {
          kind: "video",
          aspect: "16:9",
          videoReferenceMode: "standard",
          durationSeconds: 8,
          resolution: "1080p",
          generateAudio: true,
          cameraFixed: false,
          autoFix: true,
          referenceInputs: ["https://example.com/frame.png"],
        },
      },
    });

    render(
      <ReferenceGridCard
        {...createProps({
          item: output,
          isVideoPreview: true,
          cardPreviewUrl: "https://example.com/video.mp4",
          onReloadWorkflowOutput,
          onSelectOutput,
        })}
      />
    );

    const reloadButton = screen.getByLabelText("Reload workflow");

    expect(reloadButton.parentElement).toHaveClass("reference-card-workflow-reload-actions");

    fireEvent.click(reloadButton);

    expect(onSelectOutput).toHaveBeenCalledWith("out-1");
    expect(onReloadWorkflowOutput).toHaveBeenCalledWith(output, { mediaKindHint: "video" });
  });

  it("hides workflow reload for delivered videos without video reload metadata", () => {
    const onReloadWorkflowOutput = vi.fn();
    const onSelectOutput = vi.fn();
    const output = createOutput({
      mode: "image",
      taskState: "success",
      mediaSource: "generated",
      modelId: "kie-ai/kling-3.0",
      mimeType: "video/mp4",
      fullStoragePath: "user-1/generations/videos/generated-video.mp4",
      durationMs: 6_000,
      generationReplay: {
        version: 2,
        mode: "image",
        submitTool: "edit",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        displayPrompt: "Restore this as video",
        submissionPrompt: "Restore this as video",
        aspect: "16:9",
        imageResolution: "2K",
        referenceInputs: ["https://example.com/first-frame.png"],
        internalMediaRefs: [],
        capturedAt: "2026-06-06T12:00:00.000Z",
      },
    });

    render(
      <ReferenceGridCard
        {...createProps({
          item: output,
          isImagePreview: true,
          isVideoPreview: false,
          cardPreviewUrl: "https://example.com/poster.jpg",
          onReloadWorkflowOutput,
          onSelectOutput,
        })}
      />
    );

    expect(screen.queryByLabelText("Reload workflow")).toBeNull();
    expect(onSelectOutput).not.toHaveBeenCalled();
    expect(onReloadWorkflowOutput).not.toHaveBeenCalled();
  });

  it("keeps image-shaped workflow reload on the image media hint without delivery hints", () => {
    const onReloadWorkflowOutput = vi.fn();
    const onSelectOutput = vi.fn();
    const output = createOutput({
      mode: "image",
      taskState: "success",
      mediaSource: "generated",
      modelId: "kie-ai/kling-3.0",
      previewUrl: "https://example.com/signed-generated-video",
      workflowReload: {
        version: 1,
        source: "ai_studio_generation",
        capturedAt: "2026-06-06T12:00:00.000Z",
        originTool: "create",
        panelKind: "create",
        outputMode: "image",
        restoreBehavior: "navigate_and_hydrate",
        createMode: "standard",
        pulse: null,
        prompt: { display: "Restore this as video" },
        model: { id: "fal-ai/bytedance/seedream/v4.5/text-to-image" },
        payload: {
          kind: "image",
          submitTool: "create",
          aspect: "16:9",
          imageResolution: "2K",
          referenceInputs: ["https://example.com/first-frame.png"],
        },
      },
    });

    render(
      <ReferenceGridCard
        {...createProps({
          item: output,
          isImagePreview: true,
          isVideoPreview: false,
          cardPreviewUrl: "https://example.com/signed-generated-video",
          onReloadWorkflowOutput,
          onSelectOutput,
        })}
      />
    );

    fireEvent.click(screen.getByLabelText("Reload workflow"));

    expect(onSelectOutput).toHaveBeenCalledWith("out-1");
    expect(onReloadWorkflowOutput).toHaveBeenCalledWith(output, { mediaKindHint: "image" });
  });

  it("places workflow reload immediately to the right of image re-roll", () => {
    const output = createOutput({
      taskState: "success",
      mediaSource: "generated",
      generationReplay: {
        version: 1,
        mode: "image",
        submitTool: "create",
        modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        displayPrompt: "Prompt",
        submissionPrompt: "Prompt",
        aspect: "9:16",
        imageResolution: "2K",
        referenceInputs: [],
        capturedAt: "2026-06-06T12:00:00.000Z",
      },
      workflowReload: {
        version: 1,
        source: "ai_studio_generation",
        capturedAt: "2026-06-06T12:00:00.000Z",
        originTool: "create",
        panelKind: "create",
        outputMode: "image",
        restoreBehavior: "navigate_and_hydrate",
        createMode: "standard",
        pulse: null,
        prompt: { display: "Prompt" },
        model: { id: "fal-ai/bytedance/seedream/v4.5/text-to-image" },
        payload: {
          kind: "image",
          submitTool: "create",
          aspect: "9:16",
          imageResolution: "2K",
          referenceInputs: [],
        },
      },
    });

    render(
      <ReferenceGridCard
        {...createProps({
          item: output,
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/image.png",
          onRerollOutput: vi.fn(),
          onReloadWorkflowOutput: vi.fn(),
        })}
      />
    );

    const rerollButton = screen.getByLabelText("Re-roll image");
    const reloadButton = screen.getByLabelText("Reload workflow");

    expect(reloadButton.parentElement).toHaveClass("reference-card-bottom-actions");
    expect(reloadButton.previousElementSibling).toBe(rerollButton);
  });

  it("hides workflow reload when generated metadata is not restorable", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({ taskState: "success", mediaSource: "generated" }),
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/image.png",
          onReloadWorkflowOutput: vi.fn(),
        })}
      />
    );

    expect(screen.queryByLabelText("Reload workflow")).toBeNull();
  });

  it("hides video preview workflow reload when only image replay metadata exists", () => {
    const onReloadWorkflowOutput = vi.fn();
    const onSelectOutput = vi.fn();
    const output = createOutput({
      taskState: "success",
      mediaSource: "generated",
      modelId: "kie-ai/kling-3.0",
      generationReplay: {
        version: 1,
        mode: "image",
        submitTool: "edit",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        displayPrompt: "Prompt",
        submissionPrompt: "Prompt",
        aspect: "16:9",
        imageResolution: "2K",
        referenceInputs: [],
        capturedAt: "2026-06-06T12:00:00.000Z",
      },
      previewUrl: "https://example.com/video.mp4",
    });

    render(
      <ReferenceGridCard
        {...createProps({
          item: output,
          isVideoPreview: true,
          cardPreviewUrl: "https://example.com/video.mp4",
          onReloadWorkflowOutput,
          onSelectOutput,
        })}
      />
    );

    expect(screen.queryByLabelText("Reload workflow")).toBeNull();
    expect(onSelectOutput).not.toHaveBeenCalled();
    expect(onReloadWorkflowOutput).not.toHaveBeenCalled();
  });

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
    expect(videoNode?.getAttribute("src")).toBeNull();
    expect(videoSource).toBeNull();

    fireEvent.pointerEnter(card);
    expect(playMock).toHaveBeenCalled();
    expect(videoNode?.getAttribute("src")).toBe("https://example.com/video.mp4");

    fireEvent.pointerLeave(card);
    expect(pauseMock).toHaveBeenCalled();
  });

  it("does not show a generated posterless video frame as the resting card preview", async () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            mode: "video",
            taskState: "success",
            mediaSource: "generated",
          }),
          isVideoPreview: true,
          cardPreviewUrl: "https://example.com/generated-video.mp4",
          hoverVideoUrl: "https://example.com/generated-video.mp4",
          canAutoplayVideo: false,
          videoPreload: "metadata",
        })}
      />
    );

    const card = screen.getByRole("button");
    const videoNode = document.querySelector(".reference-card-video") as HTMLVideoElement | null;

    expect(videoNode).not.toBeNull();
    expect(videoNode?.classList.contains("is-visible")).toBe(false);
    expect(videoNode?.getAttribute("src")).toBeNull();

    fireEvent.pointerEnter(card);

    expect(playMock).toHaveBeenCalled();
    expect(videoNode?.getAttribute("src")).toBe("https://example.com/generated-video.mp4");
    expect(videoNode?.classList.contains("is-visible")).toBe(true);
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

  it("releases the media source when a warmed video leaves the autoplay budget", () => {
    const videoProps = createProps({
      item: createOutput({ mode: "video" }),
      isVideoPreview: true,
      cardPreviewUrl: "https://example.com/video.mp4",
      canAutoplayVideo: true,
      videoPreload: "metadata",
    });
    const { rerender } = render(<ReferenceGridCard {...videoProps} />);

    const videoNode = document.querySelector(".reference-card-video") as HTMLVideoElement | null;
    expect(videoNode).not.toBeNull();
    expect(videoNode?.getAttribute("src")).toBe("https://example.com/video.mp4");

    rerender(<ReferenceGridCard {...videoProps} canAutoplayVideo={false} videoPreload="none" />);

    expect(pauseMock).toHaveBeenCalled();
    expect(loadMock).toHaveBeenCalled();
    expect(videoNode?.getAttribute("src")).toBeNull();
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

  it("condenses provider validation detail in compact failure subtitles", () => {
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

    expect(screen.getByText("text must be 2000 characters or …")).toBeInTheDocument();
    expect(screen.queryByText("text must be 2000 characters or fewer.")).toBeNull();
  });

  it("normalizes raw JSON validation detail in compact failure subtitles", () => {
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

  it.each(AI_STUDIO_ERROR_SCENARIOS)(
    "shows compact card copy for $label without leaking full detail",
    (scenario) => {
      render(<ReferenceGridCard {...createProps({ item: scenario.output })} />);

      expect(
        screen.getAllByText((content) => content.includes(scenario.expectedCardText)).length
      ).toBeGreaterThan(0);
      for (const hiddenProbe of scenario.hiddenCardProbes) {
        expect(screen.queryByText(hiddenProbe, { exact: false })).toBeNull();
      }
    }
  );

  it("condenses opaque upstream failures for compact failure subtitles", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            model: "Kie Kling 3.0",
            modelId: "kie-ai/kling-3.0",
            errorMessage: "Internal Error, Please try again later.",
            errorMessageShort: "Generation failed",
            errorDetail: "Internal Error, Please try again later.",
          }),
        })}
      />
    );

    expect(screen.getByText("Kling 3.0 generation failed at t…")).toBeInTheDocument();
    expect(screen.queryByText("No ShortPulse credits are charged", { exact: false })).toBeNull();
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

  it("fails closed when hydrating media never receives a renderable source", async () => {
    const markLoaded = vi.fn();
    const { container } = render(
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
          imageSrc: undefined,
          markLoaded,
        })}
      />
    );

    expect(container.querySelector(".reference-card-image")).toBeNull();
    expect(container.querySelector(".reference-loading--hydrating")).not.toBeNull();
    expect(screen.queryByText("Preview unavailable")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(markLoaded).toHaveBeenCalledWith("out-1", { notifyAutoSave: false });
    expect(container.querySelector(".reference-loading--hydrating")).toBeNull();
    expect(container.querySelector(".reference-card-media-unavailable")).not.toBeNull();
  });

  it("converts hydrating image errors into controlled unavailable placeholders", () => {
    const markLoaded = vi.fn();
    const { container } = render(
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

    const image = container.querySelector(
      ".reference-card-image--cover"
    ) as HTMLImageElement | null;
    expect(image).not.toBeNull();

    fireEvent.error(image as HTMLImageElement);

    expect(container.querySelector(".reference-card-media-unavailable")).not.toBeNull();
    expect(screen.queryByText("Preview unavailable")).toBeNull();
    expect(container.querySelector(".reference-loading--hydrating")).toBeNull();
    expect(container.querySelector(".reference-card-image")).toBeNull();
    expect(markLoaded).toHaveBeenCalledWith("out-1", { notifyAutoSave: false });
  });

  it("keeps passive image load completion local to the card", () => {
    const markLoaded = vi.fn();
    const { container } = render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            taskState: "success",
            previewUrl: "https://example.com/passive.png",
          }),
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/passive.png",
          imageSrc: "https://example.com/passive.png",
          markLoaded,
        })}
      />
    );

    const image = container.querySelector(
      ".reference-card-image--cover"
    ) as HTMLImageElement | null;
    expect(image).not.toBeNull();

    fireEvent.load(image as HTMLImageElement);

    expect(markLoaded).toHaveBeenCalledWith("out-1", { notifyAutoSave: false });
  });

  it("keeps raw image previews invisible until load confirms the source", () => {
    const markLoaded = vi.fn();
    const { container, rerender } = render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            taskState: "success",
            previewUrl: "https://example.com/probing.png",
          }),
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/probing.png",
          imageSrc: "https://example.com/probing.png",
          markLoaded,
        })}
      />
    );

    const coverImage = container.querySelector(
      ".reference-card-image--cover"
    ) as HTMLImageElement | null;

    expect(coverImage).not.toBeNull();
    expect(coverImage).toHaveClass("is-probing");
    expect(container.querySelectorAll(".reference-card-image")).toHaveLength(1);

    fireEvent.load(coverImage as HTMLImageElement);

    expect(coverImage).not.toHaveClass("is-probing");
    expect(markLoaded).toHaveBeenCalledWith("out-1", { notifyAutoSave: false });

    rerender(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            taskState: "success",
            previewUrl: "https://example.com/probing-replacement.png",
          }),
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/probing-replacement.png",
          imageSrc: "https://example.com/probing-replacement.png",
          markLoaded,
        })}
      />
    );

    const replacementCoverImage = container.querySelector(
      ".reference-card-image--cover"
    ) as HTMLImageElement | null;
    expect(replacementCoverImage).not.toBeNull();
    expect(replacementCoverImage).toHaveClass("is-probing");
  });

  it("omits contain-preview mode when dense rendering does not request it", () => {
    const { container } = render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            taskState: "success",
            previewUrl: "https://example.com/passive.png",
          }),
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/passive.png",
          imageSrc: "https://example.com/passive.png",
          renderContainPreview: false,
        })}
      />
    );

    expect(container.querySelector(".reference-card-image--cover")).not.toBeNull();
    expect(container.querySelector(".reference-card-image--contain")).toBeNull();
    expect(container.querySelectorAll(".reference-card-image")).toHaveLength(1);
    expect(
      container.querySelector(".reference-card")?.classList.contains("has-contain-preview")
    ).toBe(false);
  });

  it("keeps contain-preview mode on a single image element when requested", () => {
    const { container } = render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            taskState: "success",
            previewUrl: "https://example.com/active.png",
          }),
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/active.png",
          imageSrc: "https://example.com/active.png",
          renderContainPreview: true,
        })}
      />
    );

    expect(container.querySelector(".reference-card-image--cover")).not.toBeNull();
    expect(container.querySelector(".reference-card-image--contain")).toBeNull();
    expect(container.querySelectorAll(".reference-card-image")).toHaveLength(1);
    expect(
      container.querySelector(".reference-card")?.classList.contains("has-contain-preview")
    ).toBe(true);
  });

  it("notifies parent readiness when the active image loads", () => {
    const markLoaded = vi.fn();
    const { container } = render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            taskState: "success",
            previewUrl: "https://example.com/active.png",
          }),
          activeOutputId: "out-1",
          isImagePreview: true,
          cardPreviewUrl: "https://example.com/active.png",
          imageSrc: "https://example.com/active.png",
          markLoaded,
        })}
      />
    );

    const image = container.querySelector(
      ".reference-card-image--cover"
    ) as HTMLImageElement | null;
    expect(image).not.toBeNull();

    fireEvent.load(image as HTMLImageElement);

    expect(markLoaded).toHaveBeenCalledWith("out-1", { notifyAutoSave: true });
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

    expect(container.querySelector(".reference-card-media-unavailable")).not.toBeNull();
    expect(screen.queryByText("Preview unavailable")).toBeNull();
    expect(container.querySelector(".reference-card-image")).toBeNull();
    expect(markLoaded).toHaveBeenCalledWith("out-1", { notifyAutoSave: false });
  });

  it("keeps durable media draggable even when no card preview URL is available", () => {
    const onCardDragStart = vi.fn();
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            mediaSource: "generated",
            generationId: "generation-1",
            fullStoragePath: "user-1/generations/images/full.png",
            savedMediaIds: ["media-1"],
          }),
          cardPreviewUrl: null,
          imageSrc: undefined,
          isImagePreview: false,
          onCardDragStart,
        })}
      />
    );

    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("draggable", "true");

    fireEvent.dragStart(card);

    expect(onCardDragStart).toHaveBeenCalledTimes(1);
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
            title: "Midnight Signal",
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
    expect(screen.queryByText("0:00")).toBeNull();
    expect(screen.getByText("Midnight Signal")).toBeInTheDocument();
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

  it("uses playable media URL for audio playback when card preview URL is missing", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            mode: "audio",
            taskState: "success",
            durationMs: 2000,
          }),
          isAudioPreview: true,
          cardPreviewUrl: null,
          playableMediaUrl: "https://example.com/playable-audio.mp3",
        })}
      />
    );

    const audioNode = document.querySelector(".reference-card-audio") as HTMLAudioElement | null;
    expect(audioNode).not.toBeNull();
    expect(audioNode?.getAttribute("src")).toBe("https://example.com/playable-audio.mp3");

    fireEvent.click(screen.getByRole("button", { name: "Play audio preview" }));
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  it("renders audio download and grid remove together in the card action row", () => {
    const onDownload = vi.fn();
    const onDeleteOutput = vi.fn();
    const onSelectOutput = vi.fn();
    const { container } = render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            id: "audio-ref-1",
            mode: "audio",
            taskState: "success",
            durationMs: 30_000,
          }),
          activeOutputId: "audio-ref-1",
          isAudioPreview: true,
          cardPreviewUrl: "https://example.com/audio.mp3",
          onDownload,
          onDeleteOutput,
          onSelectOutput,
        })}
      />
    );

    const downloadButton = screen.getByLabelText("Download reference");
    const removeButton = screen.getByLabelText("Remove reference from grid");
    const actionRow = downloadButton.parentElement;

    expect(actionRow).toHaveClass("reference-card-actions");
    expect(removeButton.parentElement).toBe(actionRow);
    expect(container.querySelector(".reference-card-audio-download")).toBeNull();

    fireEvent.click(downloadButton);
    expect(onSelectOutput).toHaveBeenCalledWith("audio-ref-1");
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: "audio-ref-1" }));

    fireEvent.click(removeButton);
    expect(onDeleteOutput).toHaveBeenCalledWith("audio-ref-1");
  });

  it("renders audio download and curated remove together in the curated action row", () => {
    const onDownload = vi.fn();
    const onRemoveCuratedReference = vi.fn();
    const { container } = render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({
            id: "audio-ref-1",
            mode: "audio",
            taskState: "success",
            durationMs: 30_000,
          }),
          activeOutputId: "audio-ref-1",
          isAudioPreview: true,
          cardPreviewUrl: "https://example.com/audio.mp3",
          onDownload,
          onRemoveCuratedReference,
          showCuratedRemoveAction: true,
        })}
      />
    );

    const downloadButton = screen.getByLabelText("Download reference");
    const removeButton = screen.getByLabelText("Remove from curated");
    const actionRow = downloadButton.parentElement;

    expect(actionRow).toHaveAttribute("aria-label", "Curated actions");
    expect(actionRow).toHaveClass("reference-card-actions");
    expect(removeButton.parentElement).toBe(actionRow);
    expect(container.querySelector(".reference-card-audio-download")).toBeNull();

    fireEvent.click(downloadButton);
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: "audio-ref-1" }));

    fireEvent.click(removeButton);
    expect(onRemoveCuratedReference).toHaveBeenCalledWith("audio-ref-1");
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

  it("seeks audio from waveform clicks without selecting or opening the card", () => {
    const onSelectOutput = vi.fn();
    const onOpenDetails = vi.fn();

    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({ mode: "audio", taskState: "success", durationMs: 4000 }),
          isAudioPreview: true,
          cardPreviewUrl: "https://example.com/audio-seek.mp3",
          onSelectOutput,
          onOpenDetails,
        })}
      />
    );

    const audioNode = document.querySelector(".reference-card-audio") as HTMLAudioElement | null;
    const waveform = screen.getByRole("slider", { name: "Audio seek position" });
    expect(audioNode).not.toBeNull();

    Object.defineProperty(audioNode, "duration", {
      configurable: true,
      value: 4,
    });
    Object.defineProperty(audioNode, "currentTime", {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(waveform, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 10,
        right: 110,
        top: 0,
        bottom: 40,
        width: 100,
        height: 40,
        x: 10,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    fireEvent.pointerDown(waveform, { button: 0, clientX: 60, pointerId: 1 });
    fireEvent.pointerUp(waveform, { button: 0, clientX: 60, pointerId: 1 });
    fireEvent.keyDown(waveform, { key: " " });
    fireEvent.doubleClick(waveform);

    expect(audioNode?.currentTime).toBeCloseTo(2, 3);
    expect(waveform).toHaveAttribute("aria-valuenow", "50");
    expect(onSelectOutput).not.toHaveBeenCalled();
    expect(onOpenDetails).not.toHaveBeenCalled();
  });

  it("supports keyboard seeking on the audio waveform", () => {
    render(
      <ReferenceGridCard
        {...createProps({
          item: createOutput({ mode: "audio", taskState: "success", durationMs: 20000 }),
          isAudioPreview: true,
          cardPreviewUrl: "https://example.com/audio-keyboard-seek.mp3",
        })}
      />
    );

    const audioNode = document.querySelector(".reference-card-audio") as HTMLAudioElement | null;
    const waveform = screen.getByRole("slider", { name: "Audio seek position" });
    expect(audioNode).not.toBeNull();

    Object.defineProperty(audioNode, "duration", {
      configurable: true,
      value: 20,
    });
    Object.defineProperty(audioNode, "currentTime", {
      configurable: true,
      writable: true,
      value: 2,
    });

    fireEvent.keyDown(waveform, { key: "ArrowRight" });
    expect(audioNode?.currentTime).toBeCloseTo(7, 3);

    fireEvent.keyDown(waveform, { key: "End" });
    expect(audioNode?.currentTime).toBeCloseTo(20, 3);
    expect(waveform).toHaveAttribute("aria-valuenow", "100");
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
