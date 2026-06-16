import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasMediaActionOverlay } from "../CanvasMediaActionOverlay";
import { buildGenerationReplayConfigV1 } from "../../../logic/generationReplay";
import { buildWorkflowReloadConfigV1 } from "../../../logic/workflowReload";
import type { StudioOutput } from "../../../types";
import type { CanvasImageItem, CanvasVideoItem } from "../canvasTypes";
import type { CanvasMediaActions } from "../canvasWorkspaceContracts";

const imageReplay = buildGenerationReplayConfigV1({
  mode: "image",
  submitTool: "create",
  modelId: "seedream",
  displayPrompt: "A white horse",
  submissionPrompt: "A white horse",
  aspect: "9:16",
  imageResolution: null,
  referenceInputs: [],
  capturedAt: "2026-06-16T00:00:00.000Z",
});

const videoWorkflowReload = buildWorkflowReloadConfigV1({
  capturedAt: "2026-06-16T00:00:00.000Z",
  originTool: "video",
  panelKind: "video",
  outputMode: "video",
  prompt: { display: "A cinematic video" },
  model: { id: "kie-ai/kling-3.0" },
  payload: {
    kind: "video",
    aspect: "16:9",
    videoReferenceMode: "standard",
    durationSeconds: 5,
    resolution: null,
    generateAudio: null,
    cameraFixed: null,
    autoFix: null,
    referenceInputs: [],
    internalMediaRefs: [],
    seedance2InputMode: null,
    seedance2ReferenceImageUrls: [],
    seedance2ReferenceVideoUrls: [],
    seedance2ReferenceAudioUrls: [],
    seedance2ReturnLastFrame: null,
    seedance2WebSearch: null,
    klingElements: [],
  },
});

const createImageOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-image-1",
  prompt: "A white horse",
  mode: "image",
  aspect: "9:16",
  model: "Seedream",
  modelId: "seedream",
  status: "ready",
  timestamp: "2026-06-16T00:00:00.000Z",
  mediaSource: "generated",
  generationId: "generation-image-1",
  previewUrl: "https://example.com/image.png",
  generationReplay: imageReplay ?? undefined,
  saveState: "idle",
  ...overrides,
});

const createVideoOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-video-1",
  prompt: "A cinematic video",
  mode: "video",
  aspect: "16:9",
  model: "Kling 3.0",
  modelId: "kie-ai/kling-3.0",
  status: "ready",
  timestamp: "2026-06-16T00:00:00.000Z",
  mediaSource: "generated",
  generationId: "generation-video-1",
  previewUrl: "https://example.com/video.mp4",
  workflowReload: videoWorkflowReload ?? undefined,
  saveState: "idle",
  ...overrides,
});

const imageItem: CanvasImageItem = {
  id: "canvas-image-1",
  kind: "image",
  x: 0,
  y: 0,
  z: 1,
  selected: true,
  outputId: "out-image-1",
  mediaId: "media-image-1",
  src: "https://example.com/image.png",
  alt: "A white horse",
  width: 320,
  height: 180,
};

const videoItem: CanvasVideoItem = {
  id: "canvas-video-1",
  kind: "video",
  x: 0,
  y: 0,
  z: 1,
  selected: true,
  outputId: "out-video-1",
  mediaId: "media-video-1",
  videoUrl: "https://example.com/video.mp4",
  posterUrl: "https://example.com/poster.jpg",
  width: 320,
  height: 180,
};

const createActions = (
  output: StudioOutput | null,
  overrides: Partial<CanvasMediaActions> = {}
): CanvasMediaActions => ({
  getOutputForCanvasItem: vi.fn(() => output),
  onSelectOutput: vi.fn(),
  onSaveToLibrary: vi.fn(),
  onDownload: vi.fn(),
  onRerollOutput: vi.fn(),
  onReloadWorkflowOutput: vi.fn(),
  onDeleteOutput: vi.fn(),
  ...overrides,
});

describe("CanvasMediaActionOverlay", () => {
  it("shows selected image actions and routes clicks through Reference Grid handlers", () => {
    const output = createImageOutput();
    const actions = createActions(output);
    const onParentClick = vi.fn();
    const onParentPointerDown = vi.fn();

    render(
      <div onClick={onParentClick} onPointerDown={onParentPointerDown}>
        <CanvasMediaActionOverlay item={imageItem} actions={actions} />
      </div>
    );

    const downloadButton = screen.getByLabelText("Download reference");
    expect(screen.getByLabelText("Save to media library")).toBeInTheDocument();
    expect(downloadButton).toBeInTheDocument();
    expect(screen.getByLabelText("Remove reference from grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Re-roll image")).toBeInTheDocument();
    expect(screen.getByLabelText("Reload workflow")).toBeInTheDocument();

    fireEvent.pointerDown(downloadButton);
    fireEvent.click(downloadButton);

    expect(onParentPointerDown).not.toHaveBeenCalled();
    expect(onParentClick).not.toHaveBeenCalled();
    expect(actions.onSelectOutput).toHaveBeenCalledWith("out-image-1");
    expect(actions.onDownload).toHaveBeenCalledWith(output);

    fireEvent.click(screen.getByLabelText("Re-roll image"));
    expect(actions.onRerollOutput).toHaveBeenCalledWith(output);

    fireEvent.click(screen.getByLabelText("Reload workflow"));
    expect(actions.onReloadWorkflowOutput).toHaveBeenCalledWith(output, {
      mediaKindHint: "image",
    });

    fireEvent.click(screen.getByLabelText("Remove reference from grid"));
    expect(actions.onDeleteOutput).toHaveBeenCalledWith("out-image-1");
  });

  it("keeps saved output state as a selected Canvas chip instead of a save button", () => {
    const actions = createActions(createImageOutput({ saveState: "saved" }));

    render(<CanvasMediaActionOverlay item={imageItem} actions={actions} />);

    expect(screen.getByLabelText("Saved")).toBeInTheDocument();
    expect(screen.queryByLabelText("Save to media library")).not.toBeInTheDocument();
  });

  it("uses video workflow reload hints without showing image reroll", () => {
    const output = createVideoOutput();
    const actions = createActions(output);

    render(<CanvasMediaActionOverlay item={videoItem} actions={actions} />);

    expect(screen.queryByLabelText("Re-roll image")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Reload workflow"));

    expect(actions.onReloadWorkflowOutput).toHaveBeenCalledWith(output, {
      mediaKindHint: "video",
    });
  });

  it("does not show Reference Grid actions for unselected or outputless Canvas media", () => {
    const actions = createActions(null);

    const { rerender } = render(
      <CanvasMediaActionOverlay item={{ ...imageItem, selected: false }} actions={actions} />
    );
    expect(screen.queryByLabelText("Download reference")).not.toBeInTheDocument();

    rerender(<CanvasMediaActionOverlay item={imageItem} actions={actions} />);
    expect(screen.queryByLabelText("Download reference")).not.toBeInTheDocument();
  });
});
