import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExpertEditPanelView } from "../ExpertEditPanelView";
import {
  EXPERT_EDIT_SESSION_STATE_VERSION,
  type ExpertEditSessionState,
} from "../expertEditSessionState";

vi.mock("../../../logic/inpaintSubmission", async () => {
  const actual = await vi.importActual("../../../logic/inpaintSubmission");
  return {
    ...(actual as Record<string, unknown>),
    areAdvancedExpertEditModesPubliclyAccessible: () => true,
    isEditGenerationModeToggleEnabled: () => true,
  };
});

const emptyFileList = { length: 0, item: () => null } as unknown as FileList;

const buildSessionState = ({
  transformScale = 1,
  includeMarkupStroke = false,
  includeInpaintMask = false,
}: {
  transformScale?: number;
  includeMarkupStroke?: boolean;
  includeInpaintMask?: boolean;
} = {}): ExpertEditSessionState => ({
  version: EXPERT_EDIT_SESSION_STATE_VERSION,
  layers: {
    layerIdCounter: 2,
    foundationLayerId: "layer-1",
    selectedLayerIndex: 0,
    layers: [
      {
        id: "layer-1",
        name: "layer 1",
        imageUrl: "https://example.com/original.png",
        opacity: 1,
        isAutoNamed: true,
        ownsImageUrl: false,
        transform: {
          translateXRatio: 0,
          translateYRatio: 0,
          scale: transformScale,
          rotationDeg: 0,
        },
      },
    ],
  },
  markup: {
    strokes: includeMarkupStroke
      ? [
          {
            id: "stroke-1",
            color: "#f43f5e",
            sizeRatio: 0.02,
            points: [
              { sceneX: 0.1, sceneY: 0.1 },
              { sceneX: 0.2, sceneY: 0.2 },
            ],
          },
        ]
      : [],
  },
  inpaint: {
    snapshot: {
      layers: includeInpaintMask
        ? [
            {
              layerId: "layer-1",
              width: 1,
              height: 1,
              alpha: new Uint8ClampedArray([255]),
            },
          ]
        : [],
    },
  },
});

const makeImageDropDataTransfer = (imageUrl: string) =>
  ({
    files: emptyFileList,
    types: ["image/url"],
    getData: vi.fn((type: string) => (type === "image/url" ? imageUrl : "")),
  }) as unknown as DataTransfer;

describe("ExpertEditPanelView interaction flow", () => {
  const OriginalImage = globalThis.Image;

  beforeEach(() => {
    class ImmediateImageMock {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1;
      naturalHeight = 1;

      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    // Keep image-dimension resolution deterministic in jsdom.
    globalThis.Image = ImmediateImageMock as unknown as typeof Image;
  });

  afterEach(() => {
    globalThis.Image = OriginalImage;
  });

  it("creates a second layer from a stage drop and preserves it through Center", async () => {
    render(
      <ExpertEditPanelView
        aspect="9:16"
        modelId="fal-ai/bytedance/seedream/v4.5/edit"
        modelLabel="Seedream 4.5 Edit"
        referenceImageUrl="https://example.com/original.png"
        extraImageUrls={[null, null, null]}
        referenceText=""
        imageResolution="model_default"
        aspectOptions={[]}
        isModelModalOpen={false}
        modelModalAnchor={null}
        onAspectChange={vi.fn()}
        onModelPickerOpen={vi.fn()}
        onPrimaryImageChange={vi.fn()}
        onExtraImageChange={vi.fn()}
        onPromptTextChange={vi.fn()}
        onRegenerate={vi.fn()}
        resolvePreviewUrlById={() => null}
        costCredits={2}
        isGenerateDisabled={false}
        guardrailReason={null}
        isPrimaryStageGenerating={false}
        referenceImageWarning={null}
        onImageResolutionChange={vi.fn()}
        characterOptions={[]}
        selectedCharacterId=""
        onSelectedCharacterIdChange={vi.fn()}
        isCharacterOptionsLoading={false}
        characterModeEnabled={false}
        onCharacterModeEnabledChange={vi.fn()}
        refreshCharacterOptions={async () => []}
        resolveCharacterAvatarUrlById={() => null}
        sessionState={buildSessionState()}
        onSessionStateChange={vi.fn()}
      />
    );

    const frameStack = screen.getByTestId("edit-expert-primary-canvas-frame-stack");
    fireEvent.drop(frameStack, {
      dataTransfer: makeImageDropDataTransfer("https://example.com/added.png"),
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "layer 1" })).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByLabelText("Primary composition surface"));

    const resetViewButton = await screen.findByRole("menuitem", { name: "Center" });
    fireEvent.click(resetViewButton);

    await waitFor(() => {
      expect(screen.queryByRole("menuitem", { name: "Center" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "layer 1" })).toBeInTheDocument();
  });

  it("preserves prompt-box undo ownership instead of undoing panel history", async () => {
    render(
      <ExpertEditPanelView
        aspect="9:16"
        modelId="fal-ai/bytedance/seedream/v4.5/edit"
        modelLabel="Seedream 4.5 Edit"
        referenceImageUrl="https://example.com/original.png"
        extraImageUrls={[null, null, null]}
        referenceText=""
        imageResolution="model_default"
        aspectOptions={[]}
        isModelModalOpen={false}
        modelModalAnchor={null}
        onAspectChange={vi.fn()}
        onModelPickerOpen={vi.fn()}
        onPrimaryImageChange={vi.fn()}
        onExtraImageChange={vi.fn()}
        onPromptTextChange={vi.fn()}
        onRegenerate={vi.fn()}
        resolvePreviewUrlById={() => null}
        costCredits={2}
        isGenerateDisabled={false}
        guardrailReason={null}
        isPrimaryStageGenerating={false}
        referenceImageWarning={null}
        onImageResolutionChange={vi.fn()}
        characterOptions={[]}
        selectedCharacterId=""
        onSelectedCharacterIdChange={vi.fn()}
        isCharacterOptionsLoading={false}
        characterModeEnabled={false}
        onCharacterModeEnabledChange={vi.fn()}
        refreshCharacterOptions={async () => []}
        resolveCharacterAvatarUrlById={() => null}
        sessionState={buildSessionState()}
        onSessionStateChange={vi.fn()}
      />
    );

    const frameStack = screen.getByTestId("edit-expert-primary-canvas-frame-stack");
    fireEvent.drop(frameStack, {
      dataTransfer: makeImageDropDataTransfer("https://example.com/added.png"),
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
    });

    const promptInput = screen.getByRole("textbox");
    act(() => {
      promptInput.focus();
    });
    act(() => {
      fireEvent.keyDown(promptInput, {
        key: "z",
        metaKey: true,
      });
    });

    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
  });

  it("moves keyboard focus onto the inline stage when the canvas is pressed", async () => {
    render(
      <ExpertEditPanelView
        aspect="9:16"
        modelId="fal-ai/bytedance/seedream/v4.5/edit"
        modelLabel="Seedream 4.5 Edit"
        referenceImageUrl="https://example.com/original.png"
        extraImageUrls={[null, null, null]}
        referenceText=""
        imageResolution="model_default"
        aspectOptions={[]}
        isModelModalOpen={false}
        modelModalAnchor={null}
        onAspectChange={vi.fn()}
        onModelPickerOpen={vi.fn()}
        onPrimaryImageChange={vi.fn()}
        onExtraImageChange={vi.fn()}
        onPromptTextChange={vi.fn()}
        onRegenerate={vi.fn()}
        resolvePreviewUrlById={() => null}
        costCredits={2}
        isGenerateDisabled={false}
        guardrailReason={null}
        isPrimaryStageGenerating={false}
        referenceImageWarning={null}
        onImageResolutionChange={vi.fn()}
        characterOptions={[]}
        selectedCharacterId=""
        onSelectedCharacterIdChange={vi.fn()}
        isCharacterOptionsLoading={false}
        characterModeEnabled={false}
        onCharacterModeEnabledChange={vi.fn()}
        refreshCharacterOptions={async () => []}
        resolveCharacterAvatarUrlById={() => null}
        sessionState={buildSessionState()}
        onSessionStateChange={vi.fn()}
      />
    );

    const surface = screen.getByLabelText("Primary composition surface");
    fireEvent.pointerDown(surface);

    await waitFor(() => {
      expect(document.activeElement).toBe(surface);
    });
  });

  it("renders inline transform chrome outside render clipping ancestors", async () => {
    render(
      <ExpertEditPanelView
        aspect="9:16"
        modelId="fal-ai/bytedance/seedream/v4.5/edit"
        modelLabel="Seedream 4.5 Edit"
        referenceImageUrl="https://example.com/original.png"
        extraImageUrls={[null, null, null]}
        referenceText=""
        imageResolution="model_default"
        aspectOptions={[]}
        isModelModalOpen={false}
        modelModalAnchor={null}
        onAspectChange={vi.fn()}
        onModelPickerOpen={vi.fn()}
        onPrimaryImageChange={vi.fn()}
        onExtraImageChange={vi.fn()}
        onPromptTextChange={vi.fn()}
        onRegenerate={vi.fn()}
        resolvePreviewUrlById={() => null}
        costCredits={2}
        isGenerateDisabled={false}
        guardrailReason={null}
        isPrimaryStageGenerating={false}
        referenceImageWarning={null}
        onImageResolutionChange={vi.fn()}
        characterOptions={[]}
        selectedCharacterId=""
        onSelectedCharacterIdChange={vi.fn()}
        isCharacterOptionsLoading={false}
        characterModeEnabled={false}
        onCharacterModeEnabledChange={vi.fn()}
        refreshCharacterOptions={async () => []}
        resolveCharacterAvatarUrlById={() => null}
        sessionState={buildSessionState()}
        onSessionStateChange={vi.fn()}
      />
    );

    const transformOverlay = await screen.findByTestId("edit-expert-transform-overlay-inline");
    const chromeLayer = screen.getByTestId("edit-expert-transform-chrome-layer-inline");
    const renderClip = document.querySelector(".edit-expert-stage-render-clip");
    const compositionSurface = screen.getByLabelText("Primary composition surface");

    expect(renderClip).toContainElement(compositionSurface);
    expect(chromeLayer).toContainElement(transformOverlay);
    expect(transformOverlay.closest(".edit-expert-stage-render-clip")).toBeNull();
    expect(transformOverlay.closest(".edit-expert-primary-composition-surface")).toBeNull();
    expect(transformOverlay.closest(".edit-expert-stage-camera-layer--chrome")).not.toBeNull();
  });

  it("keeps layers while Reset All clears transform, markup, and inpaint session state", async () => {
    const onSessionStateChange = vi.fn();

    render(
      <ExpertEditPanelView
        aspect="9:16"
        modelId="fal-ai/bytedance/seedream/v4.5/edit"
        modelLabel="Seedream 4.5 Edit"
        referenceImageUrl="https://example.com/original.png"
        extraImageUrls={[null, null, null]}
        referenceText=""
        imageResolution="model_default"
        aspectOptions={[]}
        isModelModalOpen={false}
        modelModalAnchor={null}
        onAspectChange={vi.fn()}
        onModelPickerOpen={vi.fn()}
        onPrimaryImageChange={vi.fn()}
        onExtraImageChange={vi.fn()}
        onPromptTextChange={vi.fn()}
        onRegenerate={vi.fn()}
        resolvePreviewUrlById={() => null}
        costCredits={2}
        isGenerateDisabled={false}
        guardrailReason={null}
        isPrimaryStageGenerating={false}
        referenceImageWarning={null}
        onImageResolutionChange={vi.fn()}
        characterOptions={[]}
        selectedCharacterId=""
        onSelectedCharacterIdChange={vi.fn()}
        isCharacterOptionsLoading={false}
        characterModeEnabled={false}
        onCharacterModeEnabledChange={vi.fn()}
        refreshCharacterOptions={async () => []}
        resolveCharacterAvatarUrlById={() => null}
        sessionState={buildSessionState({
          transformScale: 0.5,
          includeMarkupStroke: true,
          includeInpaintMask: true,
        })}
        onSessionStateChange={onSessionStateChange}
      />
    );

    const frameStack = screen.getByTestId("edit-expert-primary-canvas-frame-stack");
    fireEvent.drop(frameStack, {
      dataTransfer: makeImageDropDataTransfer("https://example.com/added.png"),
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
    });

    onSessionStateChange.mockClear();

    fireEvent.contextMenu(screen.getByLabelText("Primary composition surface"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Reset All" }));

    await waitFor(() => {
      expect(onSessionStateChange).toHaveBeenCalled();
    });

    const latestState = onSessionStateChange.mock.calls.at(-1)?.[0] as ExpertEditSessionState;
    expect(latestState.layers.layers).toHaveLength(2);
    expect(latestState.layers.layers[0]?.transform.scale).toBe(1);
    expect(latestState.layers.layers[1]?.transform.scale).toBe(1);
    expect(latestState.markup.strokes).toHaveLength(0);
    expect(latestState.inpaint.snapshot.layers).toHaveLength(0);
  });

  it("keeps zoom state in sync between inline and expanded modal surfaces", async () => {
    render(
      <ExpertEditPanelView
        aspect="9:16"
        modelId="fal-ai/bytedance/seedream/v4.5/edit"
        modelLabel="Seedream 4.5 Edit"
        referenceImageUrl="https://example.com/original.png"
        extraImageUrls={[null, null, null]}
        referenceText=""
        imageResolution="model_default"
        aspectOptions={[]}
        isModelModalOpen={false}
        modelModalAnchor={null}
        onAspectChange={vi.fn()}
        onModelPickerOpen={vi.fn()}
        onPrimaryImageChange={vi.fn()}
        onExtraImageChange={vi.fn()}
        onPromptTextChange={vi.fn()}
        onRegenerate={vi.fn()}
        resolvePreviewUrlById={() => null}
        costCredits={2}
        isGenerateDisabled={false}
        guardrailReason={null}
        isPrimaryStageGenerating={false}
        referenceImageWarning={null}
        onImageResolutionChange={vi.fn()}
        characterOptions={[]}
        selectedCharacterId=""
        onSelectedCharacterIdChange={vi.fn()}
        isCharacterOptionsLoading={false}
        characterModeEnabled={false}
        onCharacterModeEnabledChange={vi.fn()}
        refreshCharacterOptions={async () => []}
        resolveCharacterAvatarUrlById={() => null}
        sessionState={buildSessionState()}
        onSessionStateChange={vi.fn()}
      />
    );

    const surface = screen.getByLabelText("Primary composition surface");
    surface.focus();

    const inlineRect = {
      left: 0,
      top: 0,
      width: 320,
      height: 320,
      right: 320,
      bottom: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } satisfies DOMRect;
    Object.defineProperty(surface, "getBoundingClientRect", {
      configurable: true,
      value: () => inlineRect,
    });

    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -120,
      clientX: 160,
      clientY: 160,
    });
    surface.dispatchEvent(wheelEvent);

    fireEvent.contextMenu(screen.getByLabelText("Primary composition surface"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Expand" }));

    const modal = await screen.findByRole("dialog", { name: "Expanded markup canvas" });
    const modalZoomSlider = within(modal).getByLabelText("Zoom stage") as HTMLInputElement;
    expect(modalZoomSlider.value).not.toBe("50");
    await waitFor(() => {
      expect(document.querySelector(".edit-expert-markup-modal-stage")).toBe(
        document.activeElement
      );
    });

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Expanded markup canvas" })
      ).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(surface);
  });

  it("does not show the transform box when edit opens with a non-image reference URL", async () => {
    render(
      <ExpertEditPanelView
        aspect="9:16"
        modelId="fal-ai/bytedance/seedream/v4.5/edit"
        modelLabel="Seedream 4.5 Edit"
        referenceImageUrl="https://example.com/reference-audio.mp3"
        extraImageUrls={[null, null, null]}
        referenceText=""
        imageResolution="model_default"
        aspectOptions={[]}
        isModelModalOpen={false}
        modelModalAnchor={null}
        onAspectChange={vi.fn()}
        onModelPickerOpen={vi.fn()}
        onPrimaryImageChange={vi.fn()}
        onExtraImageChange={vi.fn()}
        onPromptTextChange={vi.fn()}
        onRegenerate={vi.fn()}
        resolvePreviewUrlById={() => null}
        costCredits={2}
        isGenerateDisabled={false}
        guardrailReason={null}
        isPrimaryStageGenerating={false}
        referenceImageWarning={null}
        onImageResolutionChange={vi.fn()}
        characterOptions={[]}
        selectedCharacterId=""
        onSelectedCharacterIdChange={vi.fn()}
        isCharacterOptionsLoading={false}
        characterModeEnabled={false}
        onCharacterModeEnabledChange={vi.fn()}
        refreshCharacterOptions={async () => []}
        resolveCharacterAvatarUrlById={() => null}
        sessionState={null}
        onSessionStateChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId("edit-expert-transform-overlay-inline")).not.toBeInTheDocument();
    });
  });

  it("does not show the transform box when the selected layer image fails to resolve", async () => {
    class FailedImageMock {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1;
      naturalHeight = 1;

      set src(_value: string) {
        queueMicrotask(() => {
          this.onerror?.();
        });
      }
    }

    globalThis.Image = FailedImageMock as unknown as typeof Image;

    render(
      <ExpertEditPanelView
        aspect="9:16"
        modelId="fal-ai/bytedance/seedream/v4.5/edit"
        modelLabel="Seedream 4.5 Edit"
        referenceImageUrl="https://example.com/unrenderable-preview.png"
        extraImageUrls={[null, null, null]}
        referenceText=""
        imageResolution="model_default"
        aspectOptions={[]}
        isModelModalOpen={false}
        modelModalAnchor={null}
        onAspectChange={vi.fn()}
        onModelPickerOpen={vi.fn()}
        onPrimaryImageChange={vi.fn()}
        onExtraImageChange={vi.fn()}
        onPromptTextChange={vi.fn()}
        onRegenerate={vi.fn()}
        resolvePreviewUrlById={() => null}
        costCredits={2}
        isGenerateDisabled={false}
        guardrailReason={null}
        isPrimaryStageGenerating={false}
        referenceImageWarning={null}
        onImageResolutionChange={vi.fn()}
        characterOptions={[]}
        selectedCharacterId=""
        onSelectedCharacterIdChange={vi.fn()}
        isCharacterOptionsLoading={false}
        characterModeEnabled={false}
        onCharacterModeEnabledChange={vi.fn()}
        refreshCharacterOptions={async () => []}
        resolveCharacterAvatarUrlById={() => null}
        sessionState={null}
        onSessionStateChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId("edit-expert-transform-overlay-inline")).not.toBeInTheDocument();
    });
  });

  it("does not reopen a stale transform box when edit starts with no current image authority", async () => {
    render(
      <ExpertEditPanelView
        aspect="9:16"
        modelId="fal-ai/bytedance/seedream/v4.5/edit"
        modelLabel="Seedream 4.5 Edit"
        referenceImageUrl={null}
        extraImageUrls={[null, null, null]}
        referenceText=""
        imageResolution="model_default"
        aspectOptions={[]}
        isModelModalOpen={false}
        modelModalAnchor={null}
        onAspectChange={vi.fn()}
        onModelPickerOpen={vi.fn()}
        onPrimaryImageChange={vi.fn()}
        onExtraImageChange={vi.fn()}
        onPromptTextChange={vi.fn()}
        onRegenerate={vi.fn()}
        resolvePreviewUrlById={() => null}
        costCredits={2}
        isGenerateDisabled={false}
        guardrailReason={null}
        isPrimaryStageGenerating={false}
        referenceImageWarning={null}
        onImageResolutionChange={vi.fn()}
        characterOptions={[]}
        selectedCharacterId=""
        onSelectedCharacterIdChange={vi.fn()}
        isCharacterOptionsLoading={false}
        characterModeEnabled={false}
        onCharacterModeEnabledChange={vi.fn()}
        refreshCharacterOptions={async () => []}
        resolveCharacterAvatarUrlById={() => null}
        sessionState={buildSessionState({
          transformScale: 0.5,
        })}
        onSessionStateChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId("edit-expert-transform-overlay-inline")).not.toBeInTheDocument();
    });
  });
});
