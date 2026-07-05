import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveMediaMetadataPromptText,
  type MediaFileRow,
} from "../../logic/mediaLibraryModalModel";
import {
  HIDDEN_VIDEO_SHOT_MODE_INSTRUCTIONS,
  VIDEO_SHOT_MODE_PROMPT_SEPARATOR,
} from "../../../../lib/model-runtime/videoShotModePromptVisibility";
import { createMediaLibraryDetailModalItem } from "../../logic/mediaLibraryDetailModal";
import { MediaLibraryPanelPreviewModal } from "../media-library-modal/MediaLibraryPanelPreviewModal";
import { ReferenceAudioPlayer } from "../shared/ReferenceAudioPlayer";
import { __resetExclusiveSoundPlaybackForTests } from "../shared/exclusiveSoundPlayback";

const MANUAL_WORKFLOW_RELOAD_FLAG = "NEXT_PUBLIC_AI_STUDIO_MANUAL_WORKFLOW_RELOAD_ENABLED";
const originalManualWorkflowReloadFlag = process.env[MANUAL_WORKFLOW_RELOAD_FLAG];

describe("MediaLibraryPanelPreviewModal", () => {
  beforeEach(() => {
    process.env[MANUAL_WORKFLOW_RELOAD_FLAG] = "true";
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

  afterEach(() => {
    if (originalManualWorkflowReloadFlag === undefined) {
      delete process.env[MANUAL_WORKFLOW_RELOAD_FLAG];
      return;
    }
    process.env[MANUAL_WORKFLOW_RELOAD_FLAG] = originalManualWorkflowReloadFlag;
  });

  const createPreviewItem = (
    file: MediaFileRow,
    url: string,
    overrides: Partial<Parameters<typeof createMediaLibraryDetailModalItem>[0]["fields"]> = {}
  ) =>
    createMediaLibraryDetailModalItem({
      file,
      surface: "media-library-panel",
      fields: {
        url,
        fileType: file.file_type.startsWith("audio/")
          ? "audio"
          : file.file_type.startsWith("video/")
            ? "video"
            : "image",
        filename: file.filename ?? null,
        source: "upload",
        previewStoragePath: file.preview_storage_path ?? file.storage_path,
        fullStoragePath: file.storage_path,
        previewUrl: url,
        fullUrl: url,
        ...overrides,
      },
    });

  const workflowReloadMetadata = {
    version: 1,
    source: "ai_studio_generation",
    capturedAt: "2026-06-06T14:00:00.000Z",
    originTool: "create",
    panelKind: "create",
    outputMode: "image",
    restoreBehavior: "navigate_and_hydrate",
    projectId: "project-1",
    createMode: "standard",
    pulse: null,
    prompt: {
      display: "A glass fox in a desert observatory",
    },
    model: {
      id: "fal-ai/imagen4/preview",
    },
    payload: {
      kind: "image",
      submitTool: "create",
      aspect: "16:9",
      imageResolution: "1K",
      referenceInputs: [],
      internalMediaRefs: [],
    },
  };

  const generationReplayMetadata = {
    version: 1,
    mode: "image",
    submitTool: "create",
    modelId: "fal-ai/imagen4/preview",
    displayPrompt: "A glass fox in a desert observatory",
    submissionPrompt: "A glass fox in a desert observatory",
    aspect: "16:9",
    imageResolution: "1K",
    referenceInputs: [],
    capturedAt: "2026-06-06T14:00:00.000Z",
  } as const;

  const characterContextMetadata = {
    applied: true,
    characterId: "character-1",
    characterName: "Rózalin Belaroa",
    lookId: "main",
    lookName: "Main",
    characterProfileImageUrl: "https://cdn.example.com/character.png",
  } as const;

  const styleContextMetadata = {
    applied: true,
    styleId: "style-1",
    styleName: "Digicam Photorealism",
    stylePrompt: "photoreal editorial lighting",
    stylePreviewImageUrl: "https://cdn.example.com/style.png",
  } as const;

  it("uses generated audio display titles for preview presentation", () => {
    const audioFile: MediaFileRow = {
      id: "audio-1",
      filename: "voice-note-1.mp3",
      storage_path: "user-1/generations/audio/voice-note-1.mp3",
      preview_storage_path: "user-1/generations/audio/voice-note-1.mp3",
      file_type: "audio/mpeg",
      source: "ai_studio",
      signedUrl: "https://cdn.example.com/voice-note-1.mp3",
      metadata: {
        display_title: "Quiet City Take",
      },
    };

    const item = createPreviewItem(audioFile, "https://cdn.example.com/voice-note-1.mp3", {
      source: "ai_studio",
    });

    expect(item.presentation?.title).toBe("Quiet City Take");
    expect(item.presentation?.topBarItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Quiet City Take",
        }),
      ])
    );
  });

  it("shows workflow reload only for saved AI Studio media with explicit reload metadata", () => {
    const onReloadWorkflowItem = vi.fn();
    const onClose = vi.fn();
    const generatedFile: MediaFileRow = {
      id: "image-1",
      filename: "portrait.png",
      storage_path: "user-1/media-library/portrait.png",
      preview_storage_path: "user-1/media-library/thumb-portrait.png",
      file_type: "image/png",
      source: "ai_studio",
      source_ref: "generation-1",
      signedUrl: "https://cdn.example.com/thumb-portrait.png",
      metadata: {
        workflow_reload: workflowReloadMetadata,
      },
    };
    const { rerender } = render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(generatedFile, "https://cdn.example.com/thumb-portrait.png", {
          source: "ai_studio",
        })}
        isLoading={false}
        error={null}
        onClose={onClose}
        onReloadWorkflowItem={onReloadWorkflowItem}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reload workflow" }));

    expect(onReloadWorkflowItem).toHaveBeenCalledWith(
      expect.objectContaining({ file: generatedFile })
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(
          {
            ...generatedFile,
            id: "upload-1",
            source: "upload",
            metadata: null,
          },
          "https://cdn.example.com/thumb-portrait.png",
          { source: "upload" }
        )}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onReloadWorkflowItem={onReloadWorkflowItem}
      />
    );

    expect(screen.queryByRole("button", { name: "Reload workflow" })).not.toBeInTheDocument();
  });

  it("renders saved AI Studio images with generated detail metadata", () => {
    const generatedFilename = "6e66fb53-2444-42db-98d9-352083a94e19-0.png";
    const generatedFile: MediaFileRow = {
      id: "image-1",
      filename: generatedFilename,
      storage_path: "user-1/media-library/generated.png",
      preview_storage_path: "user-1/media-library/thumb-generated.png",
      file_type: "image/png",
      source: "ai_studio",
      source_ref: "generation-1",
      signedUrl: "https://cdn.example.com/thumb-generated.png",
      metadata: {
        workflow_reload: workflowReloadMetadata,
        generation_replay: generationReplayMetadata,
        character_context: characterContextMetadata,
        style_context: styleContextMetadata,
      },
    };

    render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(generatedFile, "https://cdn.example.com/thumb-generated.png", {
          source: "ai_studio",
        })}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onDownloadItem={vi.fn()}
        onDeleteItem={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Generated image" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: generatedFilename })).not.toBeInTheDocument();
    expect(screen.getByText("Rózalin Belaroa")).toBeInTheDocument();
    expect(screen.getByText("Digicam Photorealism")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A glass fox in a desert observatory")).toBeInTheDocument();
    expect(screen.getByText("16:9")).toBeInTheDocument();
    expect(screen.getByText("1K")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Saved" })).not.toBeInTheDocument();
  });

  it("shows image resolution from workflow metadata when generation replay is unavailable", () => {
    const generatedFile: MediaFileRow = {
      id: "image-1",
      filename: "generated-portrait.png",
      storage_path: "user-1/media-library/generated.png",
      preview_storage_path: "user-1/media-library/thumb-generated.png",
      file_type: "image/png",
      source: "ai_studio",
      source_ref: "generation-1",
      signedUrl: "https://cdn.example.com/thumb-generated.png",
      metadata: {
        workflow_reload: workflowReloadMetadata,
        style_context: styleContextMetadata,
      },
    };

    const { baseElement } = render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(generatedFile, "https://cdn.example.com/thumb-generated.png", {
          source: "ai_studio",
        })}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Generated image" })).toBeInTheDocument();
    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Image/16:9/1K/Custom (the generation service-ai/imagen4/preview)"
    );
  });

  it("renders saved AI Studio videos with generated detail metadata", () => {
    const storageLikeFilename = "6e66fb53-2444-42db-98d9-352083a94e19-0.mp4";
    const generatedFile: MediaFileRow = {
      id: "video-1",
      filename: storageLikeFilename,
      storage_path: "user-1/media-library/generated-video.mp4",
      preview_storage_path: "user-1/media-library/generated-video.mp4",
      file_type: "video/mp4",
      source: "ai_studio",
      source_ref: "generation-video-1",
      signedUrl: "https://cdn.example.com/generated-video.mp4",
      metadata: {
        workflow_reload: {
          version: 1,
          source: "ai_studio_generation",
          capturedAt: "2026-06-28T12:00:00.000Z",
          originTool: "video",
          panelKind: "video",
          outputMode: "video",
          restoreBehavior: "navigate_and_hydrate",
          projectId: "project-1",
          createMode: "standard",
          pulse: null,
          prompt: {
            display: "A cinematic tracking shot across the clearing.",
          },
          model: {
            id: "kie-ai/kling-3.0",
          },
          payload: {
            kind: "video",
            aspect: "16:9",
            videoReferenceMode: "standard",
            durationSeconds: 6,
            resolution: "1080p",
            generateAudio: true,
            cameraFixed: false,
            autoFix: true,
            referenceInputs: ["https://cdn.example.com/reference-frame.png"],
          },
        },
      },
    };

    const { baseElement } = render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(generatedFile, "https://cdn.example.com/generated-video.mp4", {
          source: "ai_studio",
        })}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Generated video" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: storageLikeFilename })).not.toBeInTheDocument();
    const headerText =
      baseElement.querySelector(".art-modal-meta-pill")?.textContent?.replace(/\s+/g, " ").trim() ??
      "";
    expect(headerText).toContain("Video");
    expect(headerText).toContain("16:9");
    expect(headerText).toContain("1080p");
    expect(headerText).not.toContain(storageLikeFilename);
  });

  it("hides hidden video shot-mode prompt prefixes for generated media library details", () => {
    const userPrompt = "A neon rooftop chase";
    const injectedPrompt = `${HIDDEN_VIDEO_SHOT_MODE_INSTRUCTIONS.kling.multi}${VIDEO_SHOT_MODE_PROMPT_SEPARATOR}${userPrompt}`;
    const generatedFile: MediaFileRow = {
      id: "generated-kling-video",
      filename: "generated-kling-video.mp4",
      storage_path: "user-1/generations/videos/generated-kling-video.mp4",
      file_type: "video/mp4",
      source: "ai_studio",
      source_ref: "generation-kling-1",
      signedUrl: "https://cdn.example.com/generated-kling-video.mp4",
      metadata: {
        prompt: injectedPrompt,
        workflow_reload: {
          version: 1,
          source: "ai_studio_generation",
          capturedAt: "2026-06-28T12:00:00.000Z",
          originTool: "video",
          panelKind: "video",
          outputMode: "video",
          restoreBehavior: "navigate_and_hydrate",
          prompt: {
            display: userPrompt,
            submission: injectedPrompt,
          },
          model: { id: "kie-ai/kling-3.0" },
          payload: {
            kind: "video",
            aspect: "16:9",
            videoReferenceMode: "standard",
            durationSeconds: 6,
            resolution: "1080p",
            generateAudio: true,
            cameraFixed: false,
            autoFix: true,
            referenceInputs: ["https://cdn.example.com/reference-frame.png"],
          },
        },
      },
    };
    const promptText = resolveMediaMetadataPromptText(generatedFile.metadata);

    expect(promptText).toBe(userPrompt);

    const { baseElement } = render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(
          generatedFile,
          "https://cdn.example.com/generated-kling-video.mp4",
          {
            source: "ai_studio",
            promptText,
          }
        )}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(baseElement).toHaveTextContent(userPrompt);
    expect(baseElement).not.toHaveTextContent(HIDDEN_VIDEO_SHOT_MODE_INSTRUCTIONS.kling.multi);
  });

  it("keeps generated media on the generated detail view while preview URLs resolve", () => {
    const generatedFilename = "Regenerate_the_image_completely_from_scratch_with-1.png";
    const generatedFile: MediaFileRow = {
      id: "image-1",
      filename: generatedFilename,
      storage_path: "user-1/media-library/generated.png",
      preview_storage_path: "user-1/media-library/thumb-generated.png",
      file_type: "image/png",
      source: "ai_studio",
      source_ref: "generation-1",
      signedUrl: "https://cdn.example.com/thumb-generated.png",
      metadata: {
        workflow_reload: {
          ...workflowReloadMetadata,
          model: {
            id: "openai/nano-banana-2",
          },
          payload: {
            ...workflowReloadMetadata.payload,
            aspect: "1:1",
            imageResolution: "2K",
          },
        },
        generation_replay: {
          ...generationReplayMetadata,
          modelId: "openai/nano-banana-2",
          aspect: "1:1",
          imageResolution: "2K",
        },
        style_context: {
          ...styleContextMetadata,
          styleName: "Cinematic Hyperreal Macro",
        },
      },
    };

    render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(generatedFile, "https://cdn.example.com/thumb-generated.png", {
          source: "ai_studio",
        })}
        isLoading
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Generated image" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: generatedFilename })).not.toBeInTheDocument();
    expect(screen.getByText("1:1")).toBeInTheDocument();
    expect(screen.getByText("2K")).toBeInTheDocument();
    expect(screen.getByText("Cinematic Hyperreal Macro")).toBeInTheDocument();
  });

  it("navigates library-owned media details with left and right arrow keys", () => {
    const onNavigatePrevious = vi.fn();
    const onNavigateNext = vi.fn();
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
        item={createPreviewItem(imageFile, "https://cdn.example.com/thumb-portrait.png")}
        detailNavigation={{
          sourceSurface: "media-library-panel",
          canNavigatePrevious: true,
          canNavigateNext: true,
          onNavigatePrevious,
          onNavigateNext,
        }}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    fireEvent.keyDown(document, { key: "ArrowRight" });
    fireEvent.keyDown(document, { key: "ArrowLeft" });

    expect(onNavigateNext).toHaveBeenCalledTimes(1);
    expect(onNavigatePrevious).toHaveBeenCalledTimes(1);
  });

  it("does not navigate library-owned media details past boundaries", () => {
    const onNavigatePrevious = vi.fn();
    const onNavigateNext = vi.fn();
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
        item={createPreviewItem(imageFile, "https://cdn.example.com/thumb-portrait.png")}
        detailNavigation={{
          sourceSurface: "media-library-panel",
          canNavigatePrevious: false,
          canNavigateNext: false,
          onNavigatePrevious,
          onNavigateNext,
        }}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    fireEvent.keyDown(document, { key: "ArrowRight" });
    fireEvent.keyDown(document, { key: "ArrowLeft" });

    expect(onNavigateNext).not.toHaveBeenCalled();
    expect(onNavigatePrevious).not.toHaveBeenCalled();
  });

  it("keeps generated media detail navigation active through the generated detail view", () => {
    const onNavigateNext = vi.fn();
    const generatedFile: MediaFileRow = {
      id: "image-1",
      filename: "generated.png",
      storage_path: "user-1/media-library/generated.png",
      preview_storage_path: "user-1/media-library/thumb-generated.png",
      file_type: "image/png",
      source: "ai_studio",
      source_ref: "generation-1",
      signedUrl: "https://cdn.example.com/thumb-generated.png",
      metadata: {
        workflow_reload: workflowReloadMetadata,
        generation_replay: generationReplayMetadata,
      },
    };

    render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(generatedFile, "https://cdn.example.com/thumb-generated.png", {
          source: "ai_studio",
        })}
        detailNavigation={{
          sourceSurface: "media-library-panel",
          canNavigatePrevious: false,
          canNavigateNext: true,
          onNavigatePrevious: vi.fn(),
          onNavigateNext,
        }}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Generated image" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowRight" });

    expect(onNavigateNext).toHaveBeenCalledTimes(1);
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
          item={createPreviewItem(audioFile, "https://cdn.example.com/voice-note-1.mp3")}
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

  it("reserves modal audio playback before native playback resolves", () => {
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
          item={createPreviewItem(audioFile, "https://cdn.example.com/voice-note-1.mp3")}
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
    expect(referenceAudioNode).not.toBeNull();
    fireEvent.play(referenceAudioNode as HTMLAudioElement);

    pauseSpy.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Play audio preview" }));

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
        item={createPreviewItem(imageFile, "https://cdn.example.com/thumb-portrait.png")}
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

  it("does not report unavailable preview while a focused media asset is still loading", () => {
    const onPreviewError = vi.fn();
    const videoFile: MediaFileRow = {
      id: "video-1",
      filename: "clip.mp4",
      storage_path: "user-1/uploads/clip.mp4",
      preview_storage_path: "user-1/uploads/clip.mp4",
      file_type: "video/mp4",
      signedUrl: null,
    };

    const { rerender } = render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(videoFile, "", {
          previewUrl: null,
          fullUrl: null,
        })}
        isLoading
        error={null}
        onClose={vi.fn()}
        onPreviewError={onPreviewError}
      />
    );

    expect(onPreviewError).not.toHaveBeenCalled();
    expect(screen.getByText("Loading preview...")).toBeInTheDocument();

    rerender(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(videoFile, "", {
          previewUrl: null,
          fullUrl: null,
        })}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onPreviewError={onPreviewError}
      />
    );

    expect(onPreviewError).toHaveBeenCalledWith(expect.objectContaining({ file: videoFile }), "");
    expect(screen.getByText("Preview unavailable.")).toBeInTheDocument();
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
        item={createPreviewItem(imageFile, "https://cdn.example.com/thumb-portrait.png")}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onPreviewError={onPreviewError}
      />
    );

    const image = screen.getByAltText("portrait.png") as HTMLImageElement;
    fireEvent.error(image);

    expect(onPreviewError).toHaveBeenCalledWith(
      expect.objectContaining({ file: imageFile }),
      "https://cdn.example.com/thumb-portrait.png"
    );
    expect(screen.queryByAltText("portrait.png")).not.toBeInTheDocument();
    expect(screen.getByText("Preview unavailable.")).toBeInTheDocument();
  });

  it("falls back to an alternate shared preview URL before reporting image failure", () => {
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
        item={createPreviewItem(imageFile, "https://cdn.example.com/thumb-portrait.png", {
          fullUrl: "https://cdn.example.com/portrait.png",
        })}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onPreviewError={onPreviewError}
      />
    );

    const thumbnailImage = screen.getByAltText("portrait.png") as HTMLImageElement;
    fireEvent.error(thumbnailImage);

    const fullImage = screen.getByAltText("portrait.png") as HTMLImageElement;
    expect(fullImage.getAttribute("src")).toBe("https://cdn.example.com/portrait.png");
    expect(onPreviewError).not.toHaveBeenCalled();

    fireEvent.error(fullImage);

    expect(onPreviewError).toHaveBeenCalledWith(
      expect.objectContaining({ file: imageFile }),
      "https://cdn.example.com/portrait.png"
    );
    expect(screen.queryByAltText("portrait.png")).not.toBeInTheDocument();
    expect(screen.getByText("Preview unavailable.")).toBeInTheDocument();
  });

  it("moves video preview failures into controlled unavailable UI", () => {
    const onPreviewError = vi.fn();
    const videoFile: MediaFileRow = {
      id: "video-1",
      filename: "clip.mp4",
      storage_path: "user-1/uploads/clip.mp4",
      preview_storage_path: "user-1/uploads/clip.mp4",
      file_type: "video/mp4",
      signedUrl: "https://cdn.example.com/clip.mp4",
    };

    render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(videoFile, "https://cdn.example.com/clip.mp4")}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onPreviewError={onPreviewError}
      />
    );

    const video = document.querySelector(
      "video.media-library-panel-preview-media"
    ) as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    fireEvent.error(video as HTMLVideoElement);

    expect(onPreviewError).toHaveBeenCalledWith(
      expect.objectContaining({ file: videoFile }),
      "https://cdn.example.com/clip.mp4"
    );
    expect(document.querySelector("video.media-library-panel-preview-media")).toBeNull();
    expect(screen.getByText("Preview unavailable.")).toBeInTheDocument();
  });

  it("moves audio preview failures into controlled unavailable UI", () => {
    const onPreviewError = vi.fn();
    const audioFile: MediaFileRow = {
      id: "audio-1",
      filename: "voice-note.mp3",
      storage_path: "user-1/uploads/voice-note.mp3",
      preview_storage_path: "user-1/uploads/voice-note.mp3",
      file_type: "audio/mpeg",
      signedUrl: "https://cdn.example.com/voice-note.mp3",
    };

    render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(audioFile, "https://cdn.example.com/voice-note.mp3")}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onPreviewError={onPreviewError}
      />
    );

    const audio = document.querySelector(
      "audio.media-library-panel-preview-media"
    ) as HTMLAudioElement | null;
    expect(audio).not.toBeNull();
    fireEvent.error(audio as HTMLAudioElement);

    expect(onPreviewError).toHaveBeenCalledWith(
      expect.objectContaining({ file: audioFile }),
      "https://cdn.example.com/voice-note.mp3"
    );
    expect(document.querySelector("audio.media-library-panel-preview-media")).toBeNull();
    expect(screen.getByText("Preview unavailable.")).toBeInTheDocument();
  });

  it("shows saved music lyrics in the shared music detail stage", () => {
    const musicFile: MediaFileRow = {
      id: "music-1",
      filename: "midnight-loop.mp3",
      storage_path: "user-1/media-library/midnight-loop.mp3",
      preview_storage_path: "user-1/media-library/midnight-loop.mp3",
      file_type: "audio/mpeg",
      source: "ai_studio",
      source_ref: "generation-music-1",
      signedUrl: "https://cdn.example.com/midnight-loop.mp3",
      metadata: null,
    };

    const { baseElement } = render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(musicFile, "https://cdn.example.com/midnight-loop.mp3", {
          source: "ai_studio",
          audioSourceMode: "music",
          lyricsText: "Moonlight folded in the glass",
          companionArtUrl: "https://cdn.example.com/midnight-loop-cover.webp",
        })}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(baseElement.querySelector(".detail-modal-music-preview")).not.toBeNull();
    const musicPreview = baseElement.querySelector(
      ".detail-modal-music-preview"
    ) as HTMLDivElement | null;
    expect(musicPreview).toHaveClass("has-companion-art");
    expect(musicPreview?.style.getPropertyValue("--detail-audio-background-image")).toContain(
      "https://cdn.example.com/midnight-loop-cover.webp"
    );
    expect(baseElement.querySelector(".detail-modal-audio-preview--compact-row")).not.toBeNull();
    expect(screen.getByText("LYRICS")).toBeInTheDocument();
    expect(screen.getByLabelText("Song lyrics")).toHaveTextContent("Moonlight folded in the glass");
  });

  it("shows instrumental for saved instrumental music references", () => {
    const musicFile: MediaFileRow = {
      id: "music-2",
      filename: "instrumental-loop.mp3",
      storage_path: "user-1/media-library/instrumental-loop.mp3",
      preview_storage_path: "user-1/media-library/instrumental-loop.mp3",
      file_type: "audio/mpeg",
      source: "ai_studio",
      source_ref: "generation-music-2",
      signedUrl: "https://cdn.example.com/instrumental-loop.mp3",
      metadata: null,
    };

    render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(musicFile, "https://cdn.example.com/instrumental-loop.mp3", {
          source: "ai_studio",
          audioSourceMode: "music",
          musicMode: "instrumental",
        })}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Song lyrics")).toHaveTextContent("Instrumental");
  });

  it("does not display model metadata for library-owned generated audio details", () => {
    const audioFile: MediaFileRow = {
      id: "audio-generated-1",
      filename: "leaves-rustling.mp3",
      storage_path: "user-1/media-library/leaves-rustling.mp3",
      preview_storage_path: "user-1/media-library/leaves-rustling.mp3",
      file_type: "audio/mpeg",
      source: "ai_studio",
      source_ref: "generation-audio-1",
      signedUrl: "https://cdn.example.com/leaves-rustling.mp3",
      metadata: {
        workflow_reload: {
          version: 1,
          source: "ai_studio_generation",
          capturedAt: "2026-06-28T12:00:00.000Z",
          originTool: "sound",
          panelKind: "sound",
          outputMode: "audio",
          restoreBehavior: "navigate_and_hydrate",
          projectId: "project-1",
          createMode: "standard",
          pulse: null,
          prompt: {
            display: "leaves rustling",
          },
          model: {
            id: "custom_audio_model",
          },
          payload: {
            kind: "sound",
            text: "leaves rustling",
            durationSeconds: 8,
            outputFormat: "mp3_44100_128",
          },
        },
      },
    };

    const { baseElement } = render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(audioFile, "https://cdn.example.com/leaves-rustling.mp3", {
          source: "ai_studio",
          promptText: "leaves rustling",
        })}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    const headerText =
      baseElement.querySelector(".art-modal-meta-pill")?.textContent?.replace(/\s+/g, " ").trim() ??
      "";
    expect(headerText).toBe("Audio/leaves-rustling.mp3");
    expect(headerText).not.toContain("custom_audio_model");
    expect(headerText).not.toContain("Custom");
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
        item={createPreviewItem(
          imageFile,
          "https://project.supabase.co/storage/v1/render/image/sign/media_library/user-1/image.png?token=abc&width=320&quality=28"
        )}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByAltText("portrait.png")).not.toBeInTheDocument();
    expect(screen.getByText("Preview unavailable.")).toBeInTheDocument();

    rerender(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(
          imageFile,
          "/_next/image?url=https%3A%2F%2Fcdn.example.com%2Fsmall.jpg&w=384&q=28"
        )}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByAltText("portrait.png")).not.toBeInTheDocument();
    expect(screen.getByText("Preview unavailable.")).toBeInTheDocument();

    rerender(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(
          imageFile,
          "https://www.shortpulse.ai/_next/image?url=https%3A%2F%2Fcdn.example.com%2Fsmall.jpg&w=384&q=28"
        )}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByAltText("portrait.png")).not.toBeInTheDocument();
    expect(screen.getByText("Preview unavailable.")).toBeInTheDocument();
  });

  it("renders and routes richer detail actions for library media", () => {
    const onDownloadItem = vi.fn();
    const onDeleteItem = vi.fn();
    const imageFile: MediaFileRow = {
      id: "image-1",
      filename: "portrait.png",
      storage_path: "user-1/uploads/portrait.png",
      preview_storage_path: "user-1/uploads/thumb-portrait.png",
      file_type: "image/png",
      signedUrl: "https://cdn.example.com/thumb-portrait.png",
    };
    const item = createPreviewItem(imageFile, "https://cdn.example.com/thumb-portrait.png");

    render(
      <MediaLibraryPanelPreviewModal
        item={item}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onDownloadItem={onDownloadItem}
        onDeleteItem={onDeleteItem}
      />
    );

    expect(screen.queryByRole("button", { name: "Saved" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDownloadItem).toHaveBeenCalledWith(item);
    expect(onDeleteItem).toHaveBeenCalledWith(item);
  });

  it("passes stored video posters into the shared preview media", () => {
    const videoFile: MediaFileRow = {
      id: "video-1",
      filename: "clip.mp4",
      storage_path: "user-1/uploads/clip.mp4",
      preview_storage_path: "user-1/uploads/clip.mp4",
      file_type: "video/mp4",
      signedUrl: "https://cdn.example.com/clip.mp4",
    };

    render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(videoFile, "https://cdn.example.com/clip.mp4", {
          previewPosterUrl: "https://cdn.example.com/poster.jpg",
        })}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    const video = document.querySelector(
      "video.media-library-panel-preview-media"
    ) as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    expect(video?.getAttribute("poster")).toBe("https://cdn.example.com/poster.jpg");
  });

  it("uses stored video dimensions for the initial shared preview aspect", () => {
    const videoFile: MediaFileRow = {
      id: "video-1",
      filename: "clip.mp4",
      storage_path: "user-1/uploads/clip.mp4",
      preview_storage_path: "user-1/uploads/clip.mp4",
      file_type: "video/mp4",
      width: 1920,
      height: 1080,
      signedUrl: "https://cdn.example.com/clip.mp4",
    };

    render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(videoFile, "https://cdn.example.com/clip.mp4")}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    const video = document.querySelector(
      "video.media-library-panel-preview-media"
    ) as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    expect(video).toHaveStyle({ aspectRatio: "1.7777777777777777" });
  });

  it("shows Snapshot only for video library details and passes the preview video element", async () => {
    const onSnapshotVideoFrame = vi.fn();
    const videoFile: MediaFileRow = {
      id: "video-1",
      filename: "clip.mp4",
      storage_path: "user-1/uploads/clip.mp4",
      preview_storage_path: "user-1/uploads/clip.mp4",
      file_type: "video/mp4",
      signedUrl: "https://cdn.example.com/clip.mp4",
    };
    const imageFile: MediaFileRow = {
      id: "image-1",
      filename: "portrait.png",
      storage_path: "user-1/uploads/portrait.png",
      preview_storage_path: "user-1/uploads/thumb-portrait.png",
      file_type: "image/png",
      signedUrl: "https://cdn.example.com/thumb-portrait.png",
    };
    const videoItem = createPreviewItem(videoFile, "https://cdn.example.com/clip.mp4");
    const { rerender } = render(
      <MediaLibraryPanelPreviewModal
        item={videoItem}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onSnapshotVideoFrame={onSnapshotVideoFrame}
      />
    );

    const snapshotButton = screen.getByRole("button", { name: "Frame-shot" });
    expect(snapshotButton.closest(".art-stage-snapshot-control")).not.toBeNull();
    expect(snapshotButton.closest(".art-modal-action-row")).toBeNull();
    await act(async () => {
      fireEvent.click(snapshotButton);
    });

    const video = document.querySelector(
      "video.media-library-panel-preview-media"
    ) as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    expect(onSnapshotVideoFrame).toHaveBeenCalledWith(video, "clip.mp4");
    expect(await screen.findByText("Frame saved.")).toBeInTheDocument();

    rerender(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(imageFile, "https://cdn.example.com/thumb-portrait.png")}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        onSnapshotVideoFrame={onSnapshotVideoFrame}
      />
    );

    expect(screen.queryByRole("button", { name: "Frame-shot" })).toBeNull();
  });

  it("hides the prompt blade for uploaded library files and keeps the filename in the header", () => {
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
        item={createPreviewItem(imageFile, "https://cdn.example.com/thumb-portrait.png")}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "portrait.png" })).toBeInTheDocument();
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.queryByText("PROMPT")).not.toBeInTheDocument();
  });

  it("shows generated library prompts recovered from workflow reload metadata", () => {
    const imageFile: MediaFileRow = {
      id: "image-1",
      filename: "portrait.png",
      storage_path: "user-1/generations/portrait.png",
      preview_storage_path: "user-1/generations/thumb-portrait.png",
      file_type: "image/png",
      source: "ai_studio",
      signedUrl: "https://cdn.example.com/thumb-portrait.png",
      metadata: {
        display_title: "Desert Observatory",
        workflow_reload: workflowReloadMetadata,
      },
    };

    render(
      <MediaLibraryPanelPreviewModal
        item={createPreviewItem(imageFile, "https://cdn.example.com/thumb-portrait.png", {
          source: "ai_studio",
          promptText: resolveMediaMetadataPromptText(imageFile.metadata),
        })}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Generated image" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Desert Observatory" })).not.toBeInTheDocument();
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.getByText("PROMPT")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A glass fox in a desert observatory")).toBeInTheDocument();
  });
});
