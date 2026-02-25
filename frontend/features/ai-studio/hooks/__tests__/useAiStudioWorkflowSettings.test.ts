import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import type { StudioMode, ToolId } from "../../types";
import {
  WORKFLOW_SETTINGS_SESSION_KEY,
  useAiStudioWorkflowSettings,
} from "../useAiStudioWorkflowSettings";

const useHarness = (initialTool: ToolId | null) => {
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(initialTool);
  const [mode, setMode] = useState<StudioMode>("text");
  const [model, setModelState] = useState<string | null>(null);
  const [aspect, setAspect] = useState("9:16");
  const [imageResolution, setImageResolution] = useState("model_default");
  const [videoReferenceMode, setVideoReferenceMode] = useState<
    "standard" | "keyframes" | "kling3" | "motion"
  >("standard");
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(6);
  const [videoResolution, setVideoResolution] = useState("1080p");
  const [videoGenerateAudio, setVideoGenerateAudio] = useState(false);
  const [videoCameraFixed, setVideoCameraFixed] = useState(false);
  const [videoAutoFix, setVideoAutoFix] = useState(false);
  const [klingNegativePrompt, setKlingNegativePrompt] = useState("blur");
  const [klingCfgScale, setKlingCfgScale] = useState(0.5);
  const [klingShotType, setKlingShotType] = useState<"customize" | "intelligent">("customize");
  const [klingVoiceIds, setKlingVoiceIds] = useState<[string, string]>(["", ""]);
  const [klingMultiPrompts, setKlingMultiPrompts] = useState<
    { id: string; prompt: string; duration: number }[]
  >([]);
  const [klingElements, setKlingElements] = useState<
    { id: string; frontalImageUrl: string; referenceImageUrls: string; videoUrl: string }[]
  >([{ id: "el-1", frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" }]);

  const workflow = useAiStudioWorkflowSettings({
    selectedTool,
    mode,
    model,
    aspect,
    imageResolution,
    videoReferenceMode,
    videoDurationSeconds,
    videoResolution,
    videoGenerateAudio,
    videoCameraFixed,
    videoAutoFix,
    klingNegativePrompt,
    klingCfgScale,
    klingShotType,
    klingVoiceIds,
    klingMultiPrompts,
    klingElements,
    setMode,
    setModelState,
    setAspect,
    setImageResolution,
    setVideoReferenceMode,
    setVideoDurationSeconds,
    setVideoResolution,
    setVideoGenerateAudio,
    setVideoCameraFixed,
    setVideoAutoFix,
    setKlingNegativePrompt,
    setKlingCfgScale,
    setKlingShotType,
    setKlingVoiceIds,
    setKlingMultiPrompts,
    setKlingElements,
  });

  return {
    selectedTool,
    setSelectedTool,
    mode,
    model,
    aspect,
    videoResolution,
    setVideoResolution,
    ...workflow,
  };
};

describe("useAiStudioWorkflowSettings", () => {
  it("defaults create workflow model to Seedream text-to-image when no saved model exists", async () => {
    window.sessionStorage.clear();

    const { result } = renderHook(() => useHarness("create"));

    await waitFor(() => expect(result.current.mode).toBe("image"));
    expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image");
  });

  it("restores saved create workflow settings from session storage", async () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        create: {
          mode: "video",
          model: "fal-ai/veo3.1",
          aspect: "16:9",
          imageResolution: "2048x2048",
          videoReferenceMode: "standard",
          videoDurationSeconds: 8,
          videoResolution: "4k",
          videoGenerateAudio: true,
          videoCameraFixed: true,
          videoAutoFix: true,
          klingNegativePrompt: "noise",
          klingCfgScale: 0.8,
          klingShotType: "intelligent",
          klingVoiceIds: ["a", "b"],
          klingMultiPrompts: [{ id: "shot-1", prompt: "A", duration: 6 }],
          klingElements: [
            { id: "el-1", frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" },
          ],
        },
      })
    );

    const { result } = renderHook(() => useHarness("create"));

    await waitFor(() => expect(result.current.mode).toBe("video"));
    expect(result.current.model).toBe("fal-ai/veo3.1");
    expect(result.current.aspect).toBe("16:9");
    expect(result.current.videoResolution).toBe("4k");
  });

  it("falls back to Seedream when saved create model is invalid for create image mode", async () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        create: {
          mode: "image",
          model: "not-a-real-model-id",
          aspect: "1:1",
          imageResolution: "model_default",
          videoReferenceMode: "standard",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [
            { id: "el-1", frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" },
          ],
        },
      })
    );

    const { result } = renderHook(() => useHarness("create"));

    await waitFor(() => expect(result.current.mode).toBe("image"));
    expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image");
  });

  it("persists workflow setting updates under the active tool key", async () => {
    window.sessionStorage.clear();
    const { result } = renderHook(() => useHarness("video"));

    await waitFor(() =>
      expect(window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY)).not.toBeNull()
    );

    act(() => {
      result.current.setVideoResolution("2160p");
    });

    await waitFor(() => {
      const raw = window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, { videoResolution?: string }>) : {};
      expect(parsed.video?.videoResolution).toBe("2160p");
    });
  });
});
