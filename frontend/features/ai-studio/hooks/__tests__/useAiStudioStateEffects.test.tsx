import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MutableRefObject } from "react";
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
  isModelModalOpen: false,
  modelModalAnchor: null,
  setDetailOutputId: vi.fn(),
  setIsModelModalOpen: vi.fn(),
  setModelModalAnchor: vi.fn(),
  setModelModalPosition: vi.fn(),
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
          model: "fal-ai/kling-video/v3/pro/image-to-video",
          videoReferenceMode: "kling3",
          allowedModelValues: ["fal-ai/kling-video/v3/pro/image-to-video"],
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
});
