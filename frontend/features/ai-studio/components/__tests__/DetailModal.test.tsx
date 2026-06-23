/**
 * DetailModal behavior tests.
 * Verifies character attribution rendering for character-mode generated outputs.
 */
import { useState, type ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetailModal } from "../DetailModal";
import { ReferenceGridCard } from "../../reference-grid/components/ReferenceGridCard";
import type { StudioOutput } from "../../types";
import { getAiStudioErrorScenario } from "../../testing/errorScenarioFixtures";

const baseOutput: StudioOutput = {
  id: "out-1",
  prompt: "A cozy cinematic lounge portrait.",
  mode: "image",
  aspect: "9:16",
  model: "Seedream 4.5 Edit",
  modelId: "fal-ai/bytedance/seedream/v4.5/edit",
  status: "ready",
  timestamp: "Submitted",
  previewUrl: "https://cdn.test/image.png",
};

const buildGeneratedAudioOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  ...baseOutput,
  id: "audio-out-1",
  mode: "audio",
  aspect: "9:16",
  model: "ElevenLabs Voiceover",
  modelId: "eleven_v3",
  mediaSource: "generated",
  generationId: "gen-audio-1",
  previewUrl: "https://cdn.test/audio.mp3",
  mimeType: "audio/mpeg",
  ...overrides,
});

const createReferenceGridCardProps = (
  overrides: Partial<ComponentProps<typeof ReferenceGridCard>> = {}
): ComponentProps<typeof ReferenceGridCard> => ({
  item: baseOutput,
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

type MockImageInstance = {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
};

const installDeferredImagePreloadMock = () => {
  const originalImage = globalThis.Image;
  const imageInstances: MockImageInstance[] = [];

  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private nextSrc = "";

    get src() {
      return this.nextSrc;
    }

    set src(value: string) {
      this.nextSrc = value;
      imageInstances.push(this);
    }
  }

  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    writable: true,
    value: MockImage,
  });

  return {
    imageInstances,
    restore: () => {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
    },
  };
};

describe("DetailModal", () => {
  it("opens a failed reference from the grid and shows full provider detail in the modal", () => {
    const scenario = getAiStudioErrorScenario("provider_upstream");

    function ErrorReferenceHarness() {
      const [detailOutput, setDetailOutput] = useState<StudioOutput | null>(null);
      return (
        <>
          <ReferenceGridCard
            {...createReferenceGridCardProps({
              item: scenario.output,
              onOpenDetails: (_id, output) => setDetailOutput(output ?? null),
            })}
          />
          <DetailModal
            output={detailOutput}
            onClose={() => setDetailOutput(null)}
            onUpdatePrompt={vi.fn()}
            onDeleteOutput={vi.fn()}
          />
        </>
      );
    }

    const { baseElement } = render(<ErrorReferenceHarness />);

    expect(
      screen.getByText((content) => content.includes(scenario.expectedCardText))
    ).toBeVisible();
    expect(screen.queryByText("req_provider_upstream", { exact: false })).toBeNull();

    fireEvent.doubleClick(screen.getByRole("button"));

    expect(
      baseElement.querySelector(".reference-modal-new")?.classList.contains("is-text-only")
    ).toBe(true);
    expect(screen.getByText("Error detail")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Internal Error, Please try again later./)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/req_provider_upstream/)).toBeInTheDocument();
    expect(screen.queryByText("Media unavailable.")).not.toBeInTheDocument();
  });

  it("shows failed generation copy in the text detail body without duplicating matching summary and detail", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "failed-credits",
          mode: "video",
          previewUrl: undefined,
          resultUrls: [],
          model: "OmniHuman",
          modelId: "fal-ai/bytedance/omnihuman/v1.5",
          mediaSource: "generated",
          taskState: "fail",
          timestamp: "Failed",
          errorMessage: "Not enough credits.",
          errorMessageShort: "Not enough credits.",
          errorDetail: "Not enough credits.",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Error detail")).toBeInTheDocument();
    const errorTextareas = screen.getAllByDisplayValue("Not enough credits.");
    expect(errorTextareas).toHaveLength(1);
    expect(screen.queryByText("Media unavailable.")).not.toBeInTheDocument();
  });

  it("shows character and style attribution with the actual model used", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          characterContext: {
            applied: true,
            characterId: "char-1",
            characterName: "Taylor",
            lookId: "2",
            lookName: "Hero Close-Up",
            characterProfileImageUrl: "https://cdn.test/char.png",
          },
          styleContext: {
            applied: true,
            styleId: "photorealistic",
            styleName: "Photorealistic",
            stylePrompt: "photoreal skin texture and natural daylight contrast",
            stylePreviewImageUrl: "https://cdn.test/style.png",
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Seedream 4.5")).toBeInTheDocument();
    expect(screen.queryByText("Pulse Character")).not.toBeInTheDocument();
    const characterName = screen.getByText("Taylor");
    expect(screen.getByText("Character · Hero Close-Up")).toBeInTheDocument();
    const promptLabel = screen.getByText("PROMPT");
    expect(characterName).toBeInTheDocument();
    expect(screen.getByAltText("Taylor profile")).toBeInTheDocument();
    const styleName = screen.getByText("Photorealistic");
    expect(styleName).toBeInTheDocument();
    expect(screen.getByAltText("Photorealistic style")).toBeInTheDocument();
    expect(screen.getByLabelText("Style used for generation")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Prompt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save prompt" })).not.toBeInTheDocument();
    expect(characterName.compareDocumentPosition(promptLabel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(styleName.compareDocumentPosition(promptLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("does not fall back to legacy seeded style previews when style context has no explicit preview url", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          styleContext: {
            applied: true,
            styleId: "photorealistic",
            styleName: "Photorealistic",
            stylePrompt: "photoreal skin texture and natural daylight contrast",
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Photorealistic")).toBeInTheDocument();
    expect(screen.queryByAltText("Photorealistic style")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Style used for generation")).toHaveTextContent("PH");
  });

  it("recovers character chip avatar via injected refresh/resolver callbacks", async () => {
    let refreshedCharacterAvatarUrl: string | null = null;
    const refreshCharacterOptions = vi.fn(async () => {
      refreshedCharacterAvatarUrl = "https://cdn.test/char-refreshed.png";
      return [
        {
          id: "char-1",
          name: "Taylor",
          profileImageUrl: refreshedCharacterAvatarUrl,
        },
      ];
    });
    const resolveCharacterAvatarUrlById = vi.fn((characterId: string | null | undefined) =>
      characterId === "char-1" ? refreshedCharacterAvatarUrl : null
    );
    render(
      <DetailModal
        output={{
          ...baseOutput,
          characterContext: {
            applied: true,
            characterId: "char-1",
            characterName: "Taylor",
            characterProfileImageUrl: "broken-avatar",
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        refreshCharacterOptions={refreshCharacterOptions}
        resolveCharacterAvatarUrlById={resolveCharacterAvatarUrlById}
      />
    );

    fireEvent.error(screen.getByAltText("Taylor profile"));

    await waitFor(() => {
      expect(screen.getByAltText("Taylor profile").getAttribute("src")).toBe(
        "https://cdn.test/char-refreshed.png"
      );
    });
    expect(refreshCharacterOptions).toHaveBeenCalled();
  });

  it("falls back to style initials when the style thumbnail fails to load", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          styleContext: {
            applied: true,
            styleId: "style-1",
            styleName: "Sunset Glow",
            stylePrompt: "warm sunset cinematic grade",
            stylePreviewImageUrl: "broken-style-avatar",
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    fireEvent.error(screen.getByAltText("Sunset Glow style"));
    expect(screen.getByText("SG")).toBeInTheDocument();
  });

  it("renders text references in the shared detail modal with regular actions", () => {
    const onUpdatePrompt = vi.fn();
    const onSavePrompt = vi.fn();
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "text",
          previewUrl: undefined,
          aspect: "16:9",
          model: "Kling 3.0",
          modelId: "fal-ai/kling-video/v3/standard",
          prompt: "Original prompt",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={onUpdatePrompt}
        onDeleteOutput={vi.fn()}
        onSavePrompt={onSavePrompt}
      />
    );

    const modal = baseElement.querySelector(".reference-modal-new");
    expect(modal?.classList.contains("is-text-only")).toBe(true);
    expect(modal?.classList.contains("is-prompt-only")).toBe(false);
    expect(screen.getByText("Text detail")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Text reference" })).toBeInTheDocument();
    expect(baseElement.querySelector(".art-modal-meta-pill")?.textContent?.trim()).toBe("Text");
    expect(screen.queryByText("16:9")).not.toBeInTheDocument();
    expect(screen.queryByText("Kling 3.0")).not.toBeInTheDocument();
    expect(baseElement.querySelector(".art-prompt-only-header")).toBeNull();
    expect(baseElement.querySelector(".art-prompt-only-container")).toBeNull();
    expect(screen.queryByRole("button", { name: "Apply Changes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("is-icon-only");

    const promptTextarea = screen.getByPlaceholderText("Describe your adjustments...");
    fireEvent.change(promptTextarea, { target: { value: "Updated prompt for library" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onUpdatePrompt).toHaveBeenCalledWith("out-1", "Updated prompt for library");
    expect(onSavePrompt).toHaveBeenCalledWith("Updated prompt for library");
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();
  });

  it("edits text references immediately and applies changes on Save", () => {
    const onUpdatePrompt = vi.fn();
    render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "text",
          previewUrl: undefined,
          prompt: "Original prompt",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={onUpdatePrompt}
        onDeleteOutput={vi.fn()}
      />
    );

    const promptTextarea = screen.getByPlaceholderText("Describe your adjustments...");
    expect(promptTextarea).not.toHaveAttribute("readonly");

    fireEvent.change(promptTextarea, {
      target: { value: "Updated prompt in reference" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onUpdatePrompt).toHaveBeenCalledWith("out-1", "Updated prompt in reference");
  });

  it("keeps Enter as a text newline instead of a save shortcut", () => {
    const onUpdatePrompt = vi.fn();
    render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "text",
          previewUrl: undefined,
          prompt: "Original prompt",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={onUpdatePrompt}
        onDeleteOutput={vi.fn()}
      />
    );

    const promptTextarea = screen.getByPlaceholderText("Describe your adjustments...");
    fireEvent.change(promptTextarea, {
      target: { value: "Updated prompt\nwith a second line" },
    });
    fireEvent.keyDown(promptTextarea, { key: "Enter" });

    expect(promptTextarea).toHaveValue("Updated prompt\nwith a second line");
    expect(onUpdatePrompt).not.toHaveBeenCalled();
  });

  it("applies text reference edits when the modal closes", () => {
    const onClose = vi.fn();
    const onUpdatePrompt = vi.fn();
    render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "text",
          previewUrl: undefined,
          prompt: "Original prompt",
        }}
        onClose={onClose}
        onUpdatePrompt={onUpdatePrompt}
        onDeleteOutput={vi.fn()}
      />
    );

    const promptTextarea = screen.getByPlaceholderText("Describe your adjustments...");
    fireEvent.change(promptTextarea, {
      target: { value: "Updated prompt before close" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close text detail" }));

    expect(onUpdatePrompt).toHaveBeenCalledWith("out-1", "Updated prompt before close");
    expect(onClose).toHaveBeenCalled();
  });

  it("prefers the replay display prompt over compiled submission prompt text", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          prompt: "Apply Figure 1 styling.\n\nReference map:\n- Figure 1 = primary base image.",
          generationReplay: {
            version: 1,
            mode: "image",
            submitTool: "edit",
            modelId: "fal-ai/nano-banana-2/edit",
            displayPrompt: "Apply @img1 styling.",
            submissionPrompt:
              "Apply Figure 1 styling.\n\nReference map:\n- Figure 1 = primary base image.",
            aspect: "9:16",
            imageResolution: "1K",
            referenceInputs: ["https://cdn.test/base.png", "https://cdn.test/ref.png"],
            capturedAt: "2026-05-25T20:38:10.000Z",
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("Apply @img1 styling.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/Reference map:/)).not.toBeInTheDocument();
  });

  it("does not close when prompt text selection overextends to the backdrop", () => {
    const onClose = vi.fn();
    render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "text",
          previewUrl: undefined,
          prompt: "Original prompt",
        }}
        onClose={onClose}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const promptTextarea = screen.getByPlaceholderText("Describe your adjustments...");
    const backdrop = document.querySelector(".reference-modal-backdrop");
    expect(backdrop).not.toBeNull();

    fireEvent.pointerDown(promptTextarea, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(backdrop as Element, { button: 0, pointerId: 1 });
    fireEvent.click(backdrop as Element);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("routes download button clicks through the provided download callback", () => {
    const onDownloadReference = vi.fn();
    render(
      <DetailModal
        output={baseOutput}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onDownloadReference={onDownloadReference}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(onDownloadReference).toHaveBeenCalledWith("out-1");
  });

  it("renders Delete first, then Save before Download in the media action bar, and routes clicks through the save callback", () => {
    const onSaveReference = vi.fn();
    render(
      <DetailModal
        output={baseOutput}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onSaveReference={onSaveReference}
      />
    );

    const actionButtons = screen
      .getAllByRole("button")
      .filter((button) =>
        ["Delete", "Save", "Download"].includes(
          button.getAttribute("aria-label") ?? button.textContent ?? ""
        )
      );
    expect(
      actionButtons.map((button) => button.getAttribute("aria-label") ?? button.textContent)
    ).toEqual(["Delete", "Save", "Download"]);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveReference).toHaveBeenCalledWith("out-1");
  });

  it("promotes delete confirmation above the detail dialog and restores modal ownership on Escape", async () => {
    const onDeleteOutput = vi.fn();
    render(
      <DetailModal
        output={baseOutput}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={onDeleteOutput}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const detailDialog = document.querySelector(".reference-modal-new");
    const confirmDialog = screen.getByRole("dialog", { name: "Delete this reference?" });

    expect(detailDialog).not.toBeNull();
    expect(detailDialog).not.toHaveAttribute("aria-modal");
    expect(detailDialog).toHaveAttribute("aria-hidden", "true");
    expect(confirmDialog).toHaveAttribute("aria-modal", "true");
    expect(confirmDialog.closest(".reference-modal-new")).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete this reference?" })).toBeNull();
    });
    expect(onDeleteOutput).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Reference details" })).toHaveAttribute(
      "aria-modal",
      "true"
    );
  });

  it("closes the base detail modal on Escape when no confirmation dialog is open", () => {
    const onClose = vi.fn();
    render(
      <DetailModal
        output={baseOutput}
        onClose={onClose}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows Snapshot only for video details and passes the current video element", async () => {
    const onSnapshotVideoFrame = vi.fn();
    const { rerender, baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "video",
          previewUrl: "https://cdn.test/clip.mp4",
          mimeType: "video/mp4",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onSnapshotVideoFrame={onSnapshotVideoFrame}
      />
    );

    const snapshotButton = screen.getByRole("button", { name: "Frame-shot" });
    expect(snapshotButton.closest(".art-stage-snapshot-control")).not.toBeNull();
    expect(snapshotButton.closest(".art-modal-action-row")).toBeNull();
    await act(async () => {
      fireEvent.click(snapshotButton);
    });

    const video = baseElement.querySelector("video.art-hero-image") as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    expect(onSnapshotVideoFrame).toHaveBeenCalledWith(video, baseOutput.prompt);
    expect(await screen.findByText("Snapshot saved")).toBeInTheDocument();

    rerender(
      <DetailModal
        output={baseOutput}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onSnapshotVideoFrame={onSnapshotVideoFrame}
      />
    );

    expect(screen.queryByRole("button", { name: "Frame-shot" })).toBeNull();
  });

  it("shows workflow reload in media details only for restorable generated outputs", () => {
    const onReloadWorkflowReference = vi.fn();
    const onClose = vi.fn();
    const restorableOutput: StudioOutput = {
      ...baseOutput,
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
        prompt: { display: "A cozy cinematic lounge portrait." },
        model: { id: "fal-ai/bytedance/seedream/v4.5/text-to-image" },
        payload: {
          kind: "image",
          submitTool: "create",
          aspect: "9:16",
          imageResolution: "2K",
          referenceInputs: [],
        },
      },
    };

    const { rerender } = render(
      <DetailModal
        output={restorableOutput}
        onClose={onClose}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onReloadWorkflowReference={onReloadWorkflowReference}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reload workflow" }));
    expect(onReloadWorkflowReference).toHaveBeenCalledWith(restorableOutput, {
      mediaKindHint: "image",
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const deliveredVideoOutput: StudioOutput = {
      ...baseOutput,
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
    };
    onReloadWorkflowReference.mockClear();
    rerender(
      <DetailModal
        output={deliveredVideoOutput}
        onClose={onClose}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onReloadWorkflowReference={onReloadWorkflowReference}
      />
    );

    expect(screen.queryByRole("button", { name: "Reload workflow" })).toBeNull();
    expect(onReloadWorkflowReference).not.toHaveBeenCalled();

    const restorableVideoOutput: StudioOutput = {
      ...baseOutput,
      mode: "video",
      mediaSource: "generated",
      modelId: "kie-ai/kling-3.0",
      previewUrl: "https://cdn.test/generated-video.mp4",
      mimeType: "video/mp4",
      fullStoragePath: "user-1/generations/videos/generated-video.mp4",
      durationMs: 6_000,
      workflowReload: {
        version: 1,
        source: "ai_studio_generation",
        capturedAt: "2026-06-06T12:00:00.000Z",
        originTool: "video",
        panelKind: "video",
        outputMode: "video",
        restoreBehavior: "navigate_and_hydrate",
        pulse: null,
        prompt: { display: "A cinematic tracking shot." },
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
          referenceInputs: ["https://example.com/first-frame.png"],
        },
      },
    };
    rerender(
      <DetailModal
        output={restorableVideoOutput}
        onClose={onClose}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onReloadWorkflowReference={onReloadWorkflowReference}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reload workflow" }));
    expect(onReloadWorkflowReference).toHaveBeenCalledWith(restorableVideoOutput, {
      mediaKindHint: "video",
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <DetailModal
        output={{ ...baseOutput, mediaSource: "generated" }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onReloadWorkflowReference={onReloadWorkflowReference}
      />
    );

    expect(screen.queryByRole("button", { name: "Reload workflow" })).toBeNull();
  });

  it("hides the save action for media references that are already persisted", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          saveState: "saved",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onSaveReference={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Saved" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("hides save and download actions for generated media missing durable identity", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          mediaSource: "generated",
          generationId: undefined,
          previewStoragePath: undefined,
          fullStoragePath: undefined,
          savedMediaIds: [],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onDownloadReference={vi.fn()}
        onSaveReference={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
  });

  it("shows Retry Save for failed media persistence state", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          saveState: "failed",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onSaveReference={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Retry Save" })).toBeInTheDocument();
  });

  it("shows Retry Save and allows retrying after quota recovers", () => {
    const onSaveReference = vi.fn();
    render(
      <DetailModal
        output={{
          ...baseOutput,
          saveState: "blocked_storage",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onSaveReference={onSaveReference}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry Save" }));
    expect(onSaveReference).toHaveBeenCalledWith("out-1");
  });

  it("disables save proactively when the page knows storage is already full", () => {
    render(
      <DetailModal
        output={baseOutput}
        isMediaStorageFull
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onSaveReference={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Storage Full" })).toBeDisabled();
    expect(screen.getByText(/Your media storage is full\./i)).toBeInTheDocument();
  });

  it("keeps image previews fit-to-screen on open and does not zoom in on double-click", () => {
    const { baseElement } = render(
      <DetailModal
        output={baseOutput}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const vessel = baseElement.querySelector(".art-image-vessel");
    expect(vessel).not.toBeNull();
    if (!vessel) return;

    expect(vessel.classList.contains("is-zoomed")).toBe(false);
    fireEvent.doubleClick(vessel);
    expect(vessel.classList.contains("is-zoomed")).toBe(false);
  });

  it("treats uploaded image blob URLs as images instead of videos", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          previewUrl: "blob:https://shortpulse.test/reference-image-1",
          timestamp: "Dropped",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Image")).toBeInTheDocument();
    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Image");
    expect(baseElement.querySelector("video.art-hero-image")).toBeNull();
    expect(baseElement.querySelector("img.art-hero-image")).not.toBeNull();
  });

  it("shows only media type in the header for non-generated library media", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mediaSource: "library",
          model: "my-uploaded-file.png",
          prompt: "my-uploaded-file.png",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Image");
  });

  it("shows only media type in the header for media loaded from library modal even when source media was generated", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "library-123",
          mediaSource: "generated",
          model: "my-uploaded-file.png",
          prompt: "my-uploaded-file.png",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Image");
  });

  it("labels generated Lip Sync video metadata with resolution and product workflow", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "lip-sync-generated-video",
          mode: "video",
          aspect: "16:9",
          mediaSource: "generated",
          model: "Custom (the_generation_service-ai/bytedance/omnihuman/v1.5)",
          previewUrl: "https://cdn.test/lip-sync-result.mp4",
          resultUrls: ["https://cdn.test/lip-sync-result.mp4"],
          mimeType: "video/mp4",
          workflowReload: {
            version: 1,
            source: "ai_studio_generation",
            capturedAt: "2026-06-22T12:00:00.000Z",
            originTool: "video",
            panelKind: "video",
            outputMode: "video",
            restoreBehavior: "navigate_and_hydrate",
            pulse: null,
            prompt: { display: "Sing into the microphone." },
            model: { id: "fal-ai/bytedance/omnihuman/v1.5" },
            payload: {
              kind: "video",
              aspect: "16:9",
              videoReferenceMode: "lip-sync",
              durationSeconds: 6,
              resolution: "1080p",
              generateAudio: null,
              cameraFixed: null,
              autoFix: null,
              referenceInputs: ["https://cdn.test/lip-sync-frame.png"],
              lipSyncAudioUrl: "https://cdn.test/lip-sync-audio.mp3",
            },
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    const headerText = headerPill?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    expect(headerText).toBe("Video/16:9/1080p/Lip Sync");
    expect(headerText).not.toContain("Custom");
    expect(headerText).not.toContain("omnihuman");
    expect(headerText).not.toContain("the_generation_service");
  });

  it("renders generated voiceover audio with the normalized header label only", () => {
    const { baseElement } = render(
      <DetailModal
        output={buildGeneratedAudioOutput()}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Audio/voiceover");
  });

  it("renders generated voice changer audio with the normalized header label only", () => {
    const { baseElement } = render(
      <DetailModal
        output={buildGeneratedAudioOutput({
          model: "ElevenLabs Voice Changer",
          modelId: "eleven_multilingual_sts_v2",
        })}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Audio/voice changer");
  });

  it("renders generated music audio with the normalized header label and lyrics", () => {
    const { baseElement } = render(
      <DetailModal
        output={buildGeneratedAudioOutput({
          model: "ElevenLabs Music",
          modelId: "eleven_music_v1",
          audioSourceMode: "music",
          lyricsText: "Soft static on the wire\nWe keep moving through the night",
        })}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Audio/music");
    expect(baseElement.querySelector(".detail-modal-music-preview")).not.toBeNull();
    expect(baseElement.querySelector(".detail-modal-audio-preview--compact-row")).not.toBeNull();
    expect(screen.getByText("LYRICS")).toBeInTheDocument();
    const lyricsSection = screen.getByLabelText("Song lyrics");
    expect(lyricsSection).toHaveTextContent("Soft static on the wire");
    expect(lyricsSection).toHaveTextContent("We keep moving through the night");
  });

  it("derives music lyrics display from the audio model when the output lacks audio source mode", () => {
    render(
      <DetailModal
        output={buildGeneratedAudioOutput({
          model: "ElevenLabs Music",
          modelId: "music_v1",
          lyricsText: "The skyline hums in stereo",
        })}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("LYRICS")).toBeInTheDocument();
    expect(screen.getByText("The skyline hums in stereo")).toBeInTheDocument();
  });

  it("falls back to saved music workflow lyrics in the detail modal", () => {
    render(
      <DetailModal
        output={buildGeneratedAudioOutput({
          model: "ElevenLabs Music",
          modelId: "eleven_music_v1",
          workflowReload: {
            version: 1,
            source: "ai_studio_generation",
            capturedAt: "2026-06-10T12:00:00.000Z",
            originTool: "music",
            panelKind: "music",
            outputMode: "audio",
            restoreBehavior: "navigate_and_hydrate",
            projectId: "project-1",
            createMode: "standard",
            pulse: null,
            prompt: {
              display: "Night drive chorus",
            },
            model: {
              id: "eleven_music_v1",
            },
            payload: {
              kind: "music",
              text: "Night drive chorus",
              lyrics: "Headlights bloom over the rain",
              durationSeconds: 30,
              bpm: null,
              mode: "vocal",
              structure: "full-track",
              energyPercent: 60,
              outputFormat: "mp3_44100_128",
            },
          },
        })}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("LYRICS")).toBeInTheDocument();
    expect(screen.getByText("Headlights bloom over the rain")).toBeInTheDocument();
  });

  it("shows instrumental in the music lyrics section for instrumental music", () => {
    render(
      <DetailModal
        output={buildGeneratedAudioOutput({
          model: "ElevenLabs Music",
          modelId: "eleven_music_v1",
          audioSourceMode: "music",
          musicMode: "instrumental",
          lyricsText: null,
        })}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("LYRICS")).toBeInTheDocument();
    expect(screen.getByLabelText("Song lyrics")).toHaveTextContent("Instrumental");
    expect(screen.queryByText("Lyrics unavailable")).not.toBeInTheDocument();
  });

  it("renders generated sound effects audio with the normalized header label only", () => {
    const { baseElement } = render(
      <DetailModal
        output={buildGeneratedAudioOutput({
          model: "ElevenLabs Sound Effects",
          modelId: "eleven_sound_effects_v1",
        })}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Audio/SFX");
  });

  it("uses the audio modal sizing hook for pure audio outputs", () => {
    const { baseElement } = render(
      <DetailModal
        output={buildGeneratedAudioOutput()}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(
      baseElement.querySelector(".reference-modal-new")?.classList.contains("is-audio-modal")
    ).toBe(true);
  });

  it("keeps the aspect hidden for generated pure audio outputs", () => {
    const { baseElement } = render(
      <DetailModal
        output={buildGeneratedAudioOutput({ aspect: "9:16" })}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent).not.toContain("9:16");
  });

  it("shows voice changer and aspect for generated remuxed voice changer video", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "voice-changer-video-1",
          mode: "video",
          aspect: "16:9",
          model: "ElevenLabs Voice Changer",
          modelId: "eleven_multilingual_sts_v2",
          mediaSource: "generated",
          generationId: "gen-video-1",
          previewUrl: "https://cdn.test/remuxed-video.mp4",
          mimeType: "video/mp4",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Video/voice changer/16:9");
  });

  it("prefers transcript text for generated voice changer outputs", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "voice-changer-video-transcript-1",
          prompt: "clip.mp4 -> Narrator video",
          transcriptText: "I can hear the city waking up below us.",
          mode: "video",
          aspect: "16:9",
          model: "ElevenLabs Voice Changer",
          modelId: "eleven_multilingual_sts_v2",
          mediaSource: "generated",
          generationId: "gen-video-transcript-1",
          previewUrl: "https://cdn.test/remuxed-video.mp4",
          mimeType: "video/mp4",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("TRANSCRIPT")).toBeInTheDocument();
    expect(screen.getByDisplayValue("I can hear the city waking up below us.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("clip.mp4 -> Narrator video")).not.toBeInTheDocument();
  });

  it("shows voice changer and the preserved aspect for an active staged source video", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "source-video-1",
          mode: "video",
          aspect: "9:16",
          mediaSource: "library",
          prompt: "source-video.mp4",
          previewUrl: "https://cdn.test/source-video.mp4",
          mimeType: "video/mp4",
        }}
        context={{
          activeVoiceChangerSourceVideo: {
            aspect: "4:3",
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Video/voice changer/4:3");
  });

  it("keeps image mode previews as images when URL paths contain video-like segments", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "image",
          previewUrl:
            "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/uploads/videos/reference_asset_12345?token=abc123",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(baseElement.querySelector("video.art-hero-image")).toBeNull();
    expect(baseElement.querySelector("img.art-hero-image")).not.toBeNull();
  });

  it("does not use poster-image previews as playable media for video outputs", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "video",
          previewUrl: "https://cdn.test/video-poster.jpg",
          resultUrls: [],
          previewStoragePath: null,
          fullStoragePath: null,
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Loading media...")).toBeInTheDocument();
    expect(baseElement.querySelector("video.art-hero-image")).toBeNull();
    expect(baseElement.querySelector("img.art-hero-image")).toBeNull();
  });

  it("uses extensionless generated video result urls as playable detail media", () => {
    const videoUrl =
      "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/user-1/generations/videos/reference_asset_12345?token=abc123";
    const posterUrl = "https://cdn.test/video-poster.jpg";
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "video",
          mediaSource: "generated",
          generationId: "gen-video-1",
          previewUrl: posterUrl,
          previewPosterUrl: posterUrl,
          resultUrls: [videoUrl],
          previewStoragePath: null,
          fullStoragePath: null,
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const video = baseElement.querySelector("video.art-hero-image") as HTMLVideoElement | null;
    expect(screen.queryByText("Loading media...")).not.toBeInTheDocument();
    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(video).not.toBeNull();
    expect(video?.getAttribute("src")).toBe(videoUrl);
    expect(video?.getAttribute("poster")).toBe(posterUrl);
  });

  it("replaces a stale same-output poster candidate when Lip Sync video delivery arrives", async () => {
    const outputId = "lip-sync-transition-1";
    const posterUrl = "https://cdn.test/lip-sync-poster.jpg";
    const videoUrl = "https://cdn.test/lip-sync-result.mp4";
    const { baseElement, rerender } = render(
      <DetailModal
        output={{
          ...baseOutput,
          id: outputId,
          mode: "image",
          mediaSource: "generated",
          modelId: "fal-ai/bytedance/omnihuman/v1.5",
          previewUrl: posterUrl,
          resultUrls: [posterUrl],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(baseElement.querySelector("img.art-hero-image")).not.toBeNull();

    rerender(
      <DetailModal
        output={{
          ...baseOutput,
          id: outputId,
          mode: "video",
          mediaSource: "generated",
          modelId: "fal-ai/bytedance/omnihuman/v1.5",
          previewUrl: posterUrl,
          previewPosterUrl: posterUrl,
          resultUrls: [videoUrl],
          mimeType: "video/mp4",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    await waitFor(() => {
      const video = baseElement.querySelector("video.art-hero-image") as HTMLVideoElement | null;
      expect(video).not.toBeNull();
      expect(video?.getAttribute("src")).toBe(videoUrl);
      expect(video?.getAttribute("poster")).toBe(posterUrl);
    });
    expect(screen.queryByText("Loading media...")).not.toBeInTheDocument();
  });

  it("keeps successfully loaded media even when actual dimensions differ from aspect metadata", async () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          aspect: "16:9",
          previewUrl: "https://cdn.test/actual-3x2.png",
          resultUrls: ["https://cdn.test/actual-3x2.png", "https://cdn.test/alternate.png"],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const firstImage = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(firstImage).not.toBeNull();
    if (!firstImage) return;

    Object.defineProperty(firstImage, "naturalWidth", { configurable: true, value: 1536 });
    Object.defineProperty(firstImage, "naturalHeight", { configurable: true, value: 1024 });
    fireEvent.load(firstImage);

    await waitFor(() => {
      expect(screen.queryByText("Media unavailable.")).not.toBeInTheDocument();
    });
    const loadedImage = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(loadedImage).not.toBeNull();
    expect(loadedImage?.getAttribute("src")).toBe("https://cdn.test/actual-3x2.png");
  });

  it("updates the displayed aspect label from the actual loaded image dimensions", async () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          aspect: "16:9",
          previewUrl: "https://cdn.test/actual-3x2-label.png",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(image).not.toBeNull();
    if (!image) return;

    Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1536 });
    Object.defineProperty(image, "naturalHeight", { configurable: true, value: 1024 });
    fireEvent.load(image);

    await waitFor(() => {
      const headerPill = baseElement.querySelector(".art-modal-meta-pill");
      expect(headerPill?.textContent).toContain("3:2");
      expect(headerPill?.textContent).not.toContain("16:9");
    });
  });

  it("prefers hydrated output dimensions for the displayed aspect before the image loads", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          aspect: "3:2",
          width: 1792,
          height: 1008,
          previewUrl: "https://cdn.test/exact-16x9.png",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = baseElement.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent).toContain("16:9");
    expect(headerPill?.textContent).not.toContain("3:2");
  });

  it("keeps the active loaded URL stable when same-output delivery candidates are reordered", async () => {
    const initialOutput = {
      ...baseOutput,
      aspect: "5:4",
      previewUrl: "https://cdn.test/loaded-portrait.png",
      resultUrls: ["https://cdn.test/loaded-portrait.png", "https://cdn.test/alternate-5x4.png"],
    };
    const { baseElement, rerender } = render(
      <DetailModal
        output={initialOutput}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const firstImage = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(firstImage).not.toBeNull();
    if (!firstImage) return;

    Object.defineProperty(firstImage, "naturalWidth", { configurable: true, value: 800 });
    Object.defineProperty(firstImage, "naturalHeight", { configurable: true, value: 1000 });
    fireEvent.load(firstImage);

    await waitFor(() => {
      const nextImage = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
      expect(nextImage?.getAttribute("src")).toBe("https://cdn.test/loaded-portrait.png");
    });

    rerender(
      <DetailModal
        output={{
          ...initialOutput,
          previewUrl: "https://cdn.test/new-transient-wrong.png",
          resultUrls: [
            "https://cdn.test/new-transient-wrong.png",
            "https://cdn.test/loaded-portrait.png",
            "https://cdn.test/alternate-5x4.png",
          ],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const stableImage = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(stableImage).not.toBeNull();
    expect(stableImage?.getAttribute("src")).toBe("https://cdn.test/loaded-portrait.png");
  });

  it("promotes the open detail image after later full delivery loads", () => {
    const { imageInstances, restore } = installDeferredImagePreloadMock();
    const initialOutput = {
      ...baseOutput,
      previewUrl: "https://cdn.test/initial-preview.jpg",
      resultUrls: ["https://cdn.test/initial-preview.jpg"],
    };
    try {
      const { baseElement, rerender } = render(
        <DetailModal
          output={initialOutput}
          onClose={vi.fn()}
          onUpdatePrompt={vi.fn()}
          onDeleteOutput={vi.fn()}
        />
      );

      const initialImage = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
      expect(initialImage).not.toBeNull();
      expect(initialImage?.getAttribute("src")).toBe("https://cdn.test/initial-preview.jpg");

      rerender(
        <DetailModal
          output={{
            ...initialOutput,
            fullStoragePath: "https://cdn.test/final-full.jpg",
            previewUrl: "https://cdn.test/final-full.jpg",
            resultUrls: ["https://cdn.test/final-full.jpg"],
          }}
          onClose={vi.fn()}
          onUpdatePrompt={vi.fn()}
          onDeleteOutput={vi.fn()}
        />
      );

      const promotedImage = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
      expect(promotedImage).not.toBeNull();
      expect(promotedImage?.getAttribute("src")).toBe("https://cdn.test/initial-preview.jpg");
      expect(imageInstances.map((instance) => instance.src)).toContain(
        "https://cdn.test/final-full.jpg"
      );

      act(() => {
        imageInstances
          .filter((instance) => instance.src === "https://cdn.test/final-full.jpg")
          .at(-1)
          ?.onload?.();
      });

      expect(promotedImage?.getAttribute("src")).toBe("https://cdn.test/final-full.jpg");
    } finally {
      restore();
    }
  });

  it("promotes the first available media URL when full delivery arrives during an open session", async () => {
    const { imageInstances, restore } = installDeferredImagePreloadMock();
    const initialOutput = {
      ...baseOutput,
      previewUrl: undefined,
      resultUrls: [],
    };
    try {
      const { baseElement, rerender } = render(
        <DetailModal
          output={initialOutput}
          onClose={vi.fn()}
          onUpdatePrompt={vi.fn()}
          onDeleteOutput={vi.fn()}
        />
      );

      expect(baseElement.querySelector(".art-hero-image")).toBeNull();

      rerender(
        <DetailModal
          output={{
            ...initialOutput,
            previewUrl: "https://cdn.test/first-available.jpg",
            resultUrls: ["https://cdn.test/first-available.jpg"],
          }}
          onClose={vi.fn()}
          onUpdatePrompt={vi.fn()}
          onDeleteOutput={vi.fn()}
        />
      );

      await waitFor(() => {
        const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
        expect(image).not.toBeNull();
        expect(image?.getAttribute("src")).toBe("https://cdn.test/first-available.jpg");
      });

      rerender(
        <DetailModal
          output={{
            ...initialOutput,
            fullStoragePath: "https://cdn.test/final-after-open.jpg",
            previewUrl: "https://cdn.test/final-after-open.jpg",
            resultUrls: ["https://cdn.test/final-after-open.jpg"],
          }}
          onClose={vi.fn()}
          onUpdatePrompt={vi.fn()}
          onDeleteOutput={vi.fn()}
        />
      );

      const promotedImage = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
      expect(promotedImage).not.toBeNull();
      expect(promotedImage?.getAttribute("src")).toBe("https://cdn.test/first-available.jpg");

      act(() => {
        imageInstances
          .filter((instance) => instance.src === "https://cdn.test/final-after-open.jpg")
          .at(-1)
          ?.onload?.();
      });

      expect(promotedImage?.getAttribute("src")).toBe("https://cdn.test/final-after-open.jpg");
    } finally {
      restore();
    }
  });

  it("uses full storage media URL for detail rendering when available", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          previewStoragePath: "https://cdn.test/preview-low.jpg",
          fullStoragePath: "https://cdn.test/full-quality.jpg",
          previewUrl: "https://cdn.test/legacy.jpg",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("https://cdn.test/full-quality.jpg");
  });

  it("centers uploaded image filenames in the header and hides the prompt blade", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "upload-1",
          prompt: "create-page-current.png",
          previewUrl: "https://cdn.test/uploads/create-page-current.png",
          model: "",
          modelId: undefined,
          timestamp: "Dropped",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "create-page-current.png" })).toBeInTheDocument();
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.queryByText("PROMPT")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("create-page-current.png")).not.toBeInTheDocument();
  });

  it("hides the prompt blade for uploaded files with very long filenames", () => {
    const longFilename = `${"campaign-final-reference-".repeat(10)}still.png`;
    render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "upload-long-name",
          prompt: longFilename,
          previewUrl: `https://cdn.test/uploads/${longFilename}`,
          model: "",
          modelId: undefined,
          timestamp: "Dropped",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: longFilename })).toBeInTheDocument();
    expect(screen.queryByText("PROMPT")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(longFilename)).not.toBeInTheDocument();
  });

  it("shows generated media prompts and a normalized generated reference name", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "generated-image-1",
          prompt: "A crystal observatory under desert stars",
          mediaSource: "generated",
          generationId: "generation-1",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Generated image" })).toBeInTheDocument();
    expect(screen.getByText("PROMPT")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("A crystal observatory under desert stars")
    ).toBeInTheDocument();
  });

  it("prefers canonical preview media over transient preview url in detail rendering", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          previewStoragePath: "https://cdn.test/canonical-preview.jpg",
          fullStoragePath: null,
          previewUrl: "https://cdn.test/transient-preview.jpg",
          resultUrls: ["https://cdn.test/transient-preview.jpg"],
          mediaSource: "generated",
          generationId: "gen-1",
          savedMediaIds: [],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("https://cdn.test/canonical-preview.jpg");
  });

  it("renders controlled unavailable UI instead of a broken image when the last image candidate fails", async () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          previewUrl: "https://cdn.test/stale-signed-image.jpg",
          resultUrls: ["https://cdn.test/stale-signed-image.jpg"],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(image).not.toBeNull();
    fireEvent.error(image as HTMLImageElement);

    await waitFor(() => {
      expect(baseElement.querySelector(".art-hero-image")).toBeNull();
      expect(screen.getByText("Media unavailable.")).toBeInTheDocument();
    });
  });

  it("advances detail video media to the next preview candidate after render failure", async () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "video",
          previewUrl: "https://cdn.test/stale-signed-video.mp4",
          resultUrls: [
            "https://cdn.test/stale-signed-video.mp4",
            "https://cdn.test/recovered-video.mp4",
          ],
          mimeType: "video/mp4",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const video = baseElement.querySelector("video.art-hero-image") as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    fireEvent.error(video as HTMLVideoElement);

    await waitFor(() => {
      const recoveredVideo = baseElement.querySelector(
        "video.art-hero-image"
      ) as HTMLVideoElement | null;
      expect(recoveredVideo?.getAttribute("src")).toBe("https://cdn.test/recovered-video.mp4");
      expect(screen.queryByText("Media unavailable.")).not.toBeInTheDocument();
    });
  });

  it("advances detail audio media to the next preview candidate after render failure", async () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "audio",
          previewUrl: "https://cdn.test/stale-signed-audio.mp3",
          resultUrls: [
            "https://cdn.test/stale-signed-audio.mp3",
            "https://cdn.test/recovered-audio.mp3",
          ],
          mimeType: "audio/mpeg",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const audio = baseElement.querySelector("audio.art-hero-audio") as HTMLAudioElement | null;
    expect(audio).not.toBeNull();
    expect(baseElement.querySelector(".detail-modal-audio-preview")).not.toBeNull();
    expect(baseElement.querySelector(".detail-modal-audio-waveform-panel")).toBeNull();
    expect(baseElement.querySelectorAll(".detail-modal-audio-wavebar").length).toBeGreaterThan(40);
    expect(screen.getByRole("button", { name: "Play audio preview" })).toBeInTheDocument();
    const waveform = screen.getByRole("button", { name: "Seek audio waveform" });
    Object.defineProperty(audio, "duration", { configurable: true, value: 20 });
    Object.defineProperty(waveform, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 118,
        height: 118,
        left: 100,
        right: 500,
        top: 0,
        width: 400,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    fireEvent.click(waveform, { clientX: 300 });
    expect(audio?.currentTime).toBeCloseTo(10);
    fireEvent.error(audio as HTMLAudioElement);

    await waitFor(() => {
      const recoveredAudio = baseElement.querySelector(
        "audio.art-hero-audio"
      ) as HTMLAudioElement | null;
      expect(recoveredAudio?.getAttribute("src")).toBe("https://cdn.test/recovered-audio.mp3");
      expect(screen.queryByText("Media unavailable.")).not.toBeInTheDocument();
    });
  });

  it("does not settle detail modal images on Supabase render-image urls when full media is available", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          previewUrl:
            "https://project.supabase.co/storage/v1/render/image/sign/media_library/user-1/image.png?token=abc&width=320&quality=28",
          resultUrls: [
            "/_next/image?url=https%3A%2F%2Fcdn.test%2Fsmall.jpg&w=384&q=28",
            "https://cdn.test/full-image.jpg",
          ],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("https://cdn.test/full-image.jpg");
  });

  it("allows a Next optimizer url as a temporary detail preview bridge", () => {
    const optimizedPreviewUrl =
      "/_next/image?url=https%3A%2F%2Fcdn.test%2Ftemporary-preview.jpg&w=384&q=28";

    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          previewUrl: optimizedPreviewUrl,
          resultUrls: [optimizedPreviewUrl],
          previewStoragePath: null,
          fullStoragePath: null,
          mediaSource: "generated",
          generationId: undefined,
          savedMediaIds: [],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe(optimizedPreviewUrl);
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.queryByText("Media unavailable.")).not.toBeInTheDocument();
  });
});
