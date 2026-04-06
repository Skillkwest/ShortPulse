import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MutableRefObject } from "react";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import { useAiStudioStateEffects } from "../useAiStudioStateEffects";

const createArgs = (
  overrides: Partial<Parameters<typeof useAiStudioStateEffects>[0]> = {}
): Parameters<typeof useAiStudioStateEffects>[0] => ({
  promptRef: { current: null } as MutableRefObject<HTMLTextAreaElement | null>,
  aspect: "9:16",
  setAspect: vi.fn(),
  activeOutputPreviewUrl: null,
  setUseReferenceImageIndicator: vi.fn(),
  model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  referenceImageUrl: null,
  extraImageUrls: [null, null, null],
  selectedTool: "create",
  videoReferenceMode: "standard",
  setVideoReferenceMode: vi.fn(),
  setModel: vi.fn(),
  lastVideoReferenceModeRef: { current: "standard" },
  lastNonKling3VideoModelRef: { current: null },
  lastNonKeyframesVideoModelRef: { current: null },
  lastNonMotionVideoModelRef: { current: null },
  showCreateTools: true,
  setShowCreateTools: vi.fn(),
  videoDurationStorageKey: "video-duration",
  videoResolutionStorageKey: "video-resolution",
  imageResolutionStorageKey: "image-resolution",
  videoDurationSeconds: 6,
  setVideoDurationSeconds: vi.fn(),
  videoResolution: "1080p",
  setVideoResolution: vi.fn(),
  imageResolution: "model_default",
  setImageResolution: vi.fn(),
  hasUserVideoPrefs: true,
  setHasUserVideoPrefs: vi.fn(),
  setVideoGenerateAudio: vi.fn(),
  allowedModelValues: ["fal-ai/bytedance/seedream/v4.5/edit", "fal-ai/nano-banana-pro/edit"],
  isCharacterModeEnabled: true,
  mode: "image",
  setDetailOutputId: vi.fn(),
  setIsModelModalOpen: vi.fn(),
  setModelModalAnchor: vi.fn(),
  hasPendingWorkflowRestore: false,
  ...overrides,
});

describe("useAiStudioStateEffects", () => {
  it("maps create text-to-image models to paired edit variants when character mode is enabled", async () => {
    const setModel = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          model: "fal-ai/nano-banana-pro",
          setModel,
          isCharacterModeEnabled: true,
          allowedModelValues: [
            "fal-ai/bytedance/seedream/v4.5/edit",
            "fal-ai/nano-banana-pro/edit",
          ],
        })
      )
    );

    await waitFor(() => {
      expect(setModel).toHaveBeenCalledWith("fal-ai/nano-banana-pro/edit");
    });
  });

  it("maps create edit variants back to paired text-to-image models when character mode is disabled", async () => {
    const setModel = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          model: "fal-ai/nano-banana-pro/edit",
          setModel,
          isCharacterModeEnabled: false,
          allowedModelValues: [
            "fal-ai/bytedance/seedream/v4.5/text-to-image",
            "fal-ai/nano-banana-pro",
          ],
        })
      )
    );

    await waitFor(() => {
      expect(setModel).toHaveBeenCalledWith("fal-ai/nano-banana-pro");
    });
  });

  it("does not issue redundant setter writes when kling model/mode are already aligned", async () => {
    const setModel = vi.fn();
    const setVideoReferenceMode = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          selectedTool: "kling",
          model: KIE_KLING_30_MODEL_ID,
          videoReferenceMode: "kling3",
          allowedModelValues: [KIE_KLING_30_MODEL_ID],
          setModel,
          setVideoReferenceMode,
          hasPendingWorkflowRestore: false,
        })
      )
    );

    await waitFor(() => {
      expect(setModel).not.toHaveBeenCalled();
      expect(setVideoReferenceMode).not.toHaveBeenCalled();
    });
  });

  it("migrates legacy Fal Kling image selections onto Kie Kling when a frame image is present", async () => {
    const setModel = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          selectedTool: "video",
          model: "fal-ai/kling-video/v3/pro/image-to-video",
          referenceImageUrl: "https://example.com/first.png",
          extraImageUrls: [null, null, null],
          allowedModelValues: [KIE_KLING_30_MODEL_ID, KIE_VEO_31_FAST_I2V_MODEL_ID],
          setModel,
        })
      )
    );

    await waitFor(() => {
      expect(setModel).toHaveBeenCalledWith(KIE_KLING_30_MODEL_ID);
    });
  });

  it("migrates legacy Fal Kling text selections onto Kie Veo when no frame images are present", async () => {
    const setModel = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          selectedTool: "video",
          model: "fal-ai/kling-video/v3/pro/text-to-video",
          referenceImageUrl: null,
          extraImageUrls: [null, null, null],
          allowedModelValues: [KIE_KLING_30_MODEL_ID, KIE_VEO_31_FAST_I2V_MODEL_ID],
          setModel,
        })
      )
    );

    await waitFor(() => {
      expect(setModel).toHaveBeenCalledWith(KIE_VEO_31_FAST_I2V_MODEL_ID);
    });
  });

  it("preserves an explicit Kie Kling selection when no frame images are present", async () => {
    const setModel = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          selectedTool: "video",
          model: KIE_KLING_30_MODEL_ID,
          referenceImageUrl: null,
          extraImageUrls: [null, null, null],
          allowedModelValues: [KIE_VEO_31_FAST_I2V_MODEL_ID, KIE_KLING_30_MODEL_ID],
          setModel,
        })
      )
    );

    await waitFor(() => {
      expect(setModel).not.toHaveBeenCalledWith(KIE_VEO_31_FAST_I2V_MODEL_ID);
    });
  });

  it("locks motion mode to Kie Kling model", async () => {
    const setModel = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          selectedTool: "video",
          model: "fal-ai/veo3.1/image-to-video",
          videoReferenceMode: "motion",
          setModel,
        })
      )
    );

    await waitFor(() => {
      expect(setModel).toHaveBeenCalledWith(KIE_KLING_30_MODEL_ID);
    });
  });

  it("migrates legacy Fal Veo keyframe selections onto Kie Veo", async () => {
    const setVideoReferenceMode = vi.fn();
    const setModel = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          selectedTool: "video",
          model: "fal-ai/veo3.1/first-last-frame-to-video",
          videoReferenceMode: "standard",
          allowedModelValues: [
            "fal-ai/veo3.1/first-last-frame-to-video",
            "fal-ai/veo3.1/image-to-video",
            KIE_VEO_31_FAST_I2V_MODEL_ID,
          ],
          setVideoReferenceMode,
          setModel,
        })
      )
    );

    await waitFor(() => {
      expect(setVideoReferenceMode).toHaveBeenCalledWith("keyframes");
      expect(setModel).toHaveBeenCalledWith(KIE_VEO_31_FAST_I2V_MODEL_ID);
    });
  });

  it("switches Google-family video models to Kie Veo text lane when no frame images are present", async () => {
    const setModel = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          selectedTool: "video",
          model: "fal-ai/veo3.1/image-to-video",
          referenceImageUrl: null,
          extraImageUrls: [null, null, null],
          allowedModelValues: [KIE_VEO_31_FAST_I2V_MODEL_ID],
          setModel,
        })
      )
    );

    await waitFor(() => {
      expect(setModel).toHaveBeenCalledWith(KIE_VEO_31_FAST_I2V_MODEL_ID);
    });
  });

  it("switches Google-family video models to Kie Veo when both frame images are present", async () => {
    const setModel = vi.fn();
    const setVideoReferenceMode = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          selectedTool: "video",
          model: "fal-ai/veo3.1",
          referenceImageUrl: "https://example.com/first.png",
          extraImageUrls: ["https://example.com/last.png", null, null],
          allowedModelValues: [KIE_VEO_31_FAST_I2V_MODEL_ID],
          setModel,
          setVideoReferenceMode,
        })
      )
    );

    await waitFor(() => {
      expect(setModel).toHaveBeenCalledWith(KIE_VEO_31_FAST_I2V_MODEL_ID);
      expect(setVideoReferenceMode).toHaveBeenCalledWith("keyframes");
    });
  });

  it("defaults create workflow to Seedream text-to-image when model is null", async () => {
    const setModel = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          model: null,
          selectedTool: "create",
          mode: "image",
          isCharacterModeEnabled: false,
          allowedModelValues: ["fal-ai/bytedance/seedream/v4.5/text-to-image"],
          setModel,
        })
      )
    );

    await waitFor(() => {
      expect(setModel).toHaveBeenCalledWith("fal-ai/bytedance/seedream/v4.5/text-to-image");
    });
  });

  it("defaults create workflow to Seedream text-to-image when mode is text and model is null", async () => {
    const setModel = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          model: null,
          selectedTool: "create",
          mode: "text",
          isCharacterModeEnabled: false,
          allowedModelValues: ["fal-ai/bytedance/seedream/v4.5/text-to-image"],
          setModel,
        })
      )
    );

    await waitFor(() => {
      expect(setModel).toHaveBeenCalledWith("fal-ai/bytedance/seedream/v4.5/text-to-image");
    });
  });

  it("defaults edit workflow to Seedream edit when model is null", async () => {
    const setModel = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          model: null,
          selectedTool: "edit",
          mode: "image",
          allowedModelValues: ["fal-ai/bytedance/seedream/v4.5/edit"],
          setModel,
        })
      )
    );

    await waitFor(() => {
      expect(setModel).toHaveBeenCalledWith("fal-ai/bytedance/seedream/v4.5/edit");
    });
  });

  it("does not force square aspect on edit workflow activation when the aspect is valid", async () => {
    const setAspect = vi.fn();
    renderHook(() =>
      useAiStudioStateEffects(
        createArgs({
          aspect: "9:16",
          selectedTool: "edit",
          setAspect,
        })
      )
    );

    await waitFor(() => {
      expect(setAspect).not.toHaveBeenCalled();
    });
  });
});
