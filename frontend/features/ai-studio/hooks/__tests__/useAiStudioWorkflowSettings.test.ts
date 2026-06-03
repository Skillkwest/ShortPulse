import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import type { StudioMode, ToolId } from "../../types";
import {
  WORKFLOW_SETTINGS_SESSION_KEY,
  useAiStudioWorkflowSettings,
} from "../useAiStudioWorkflowSettings";
import type { AiStudioKlingElement } from "../../logic/klingElements";

const createTestKlingElement = (
  overrides: Partial<AiStudioKlingElement> = {}
): AiStudioKlingElement => ({
  id: "el-1",
  frontalImageUrl: "",
  referenceImageUrls: "",
  videoUrl: "",
  ...overrides,
});

const useHarness = (
  initialTool: ToolId | null,
  sessionId = "session-1",
  projectId: string | null = null,
  projectRouteRequested = false,
  isCharacterModeEnabled = false
) => {
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(initialTool);
  const [mode, setMode] = useState<StudioMode>("text");
  const [model, setModelState] = useState<string | null>(null);
  const [aspect, setAspect] = useState("9:16");
  const [imageResolution, setImageResolution] = useState("model_default");
  const [videoReferenceMode, setVideoReferenceMode] = useState<
    "standard" | "modify" | "keyframes" | "kling3" | "motion"
  >("standard");
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(6);
  const [videoResolution, setVideoResolution] = useState("1080p");
  const [videoGenerateAudio, setVideoGenerateAudio] = useState(false);
  const [videoCameraFixed, setVideoCameraFixed] = useState(false);
  const [videoAutoFix, setVideoAutoFix] = useState(false);
  const [klingNegativePrompt, setKlingNegativePrompt] = useState("blur");
  const [klingCfgScale, setKlingCfgScale] = useState(0.5);
  const [klingWorkflowMode, setKlingWorkflowMode] = useState<"single" | "multi" | "custom">(
    "single"
  );
  const [seedance2InputMode, setSeedance2InputMode] = useState<
    "text" | "first-frame" | "first-last" | "multimodal"
  >("text");
  const [seedance2ReferenceImageUrls, setSeedance2ReferenceImageUrls] = useState<string[]>([]);
  const [seedance2ReferenceVideoUrls, setSeedance2ReferenceVideoUrls] = useState<string[]>([]);
  const [seedance2ReferenceAudioUrls, setSeedance2ReferenceAudioUrls] = useState<string[]>([]);
  const [seedance2ReturnLastFrame, setSeedance2ReturnLastFrame] = useState(false);
  const [seedance2WebSearch, setSeedance2WebSearch] = useState(false);
  const [klingShotType, setKlingShotType] = useState<"customize" | "intelligent">("customize");
  const [klingVoiceIds, setKlingVoiceIds] = useState<[string, string]>(["", ""]);
  const [klingMultiPrompts, setKlingMultiPrompts] = useState<
    { id: string; prompt: string; duration: number }[]
  >([]);
  const [klingElements, setKlingElements] = useState<AiStudioKlingElement[]>([
    createTestKlingElement(),
  ]);

  const workflow = useAiStudioWorkflowSettings({
    projectId,
    projectRouteRequested,
    sessionId,
    isCharacterModeEnabled,
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
    klingWorkflowMode,
    seedance2InputMode,
    seedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    seedance2ReturnLastFrame,
    seedance2WebSearch,
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
    setKlingWorkflowMode,
    setSeedance2InputMode,
    setSeedance2ReferenceImageUrls,
    setSeedance2ReferenceVideoUrls,
    setSeedance2ReferenceAudioUrls,
    setSeedance2ReturnLastFrame,
    setSeedance2WebSearch,
    setKlingShotType,
    setKlingVoiceIds,
    setKlingMultiPrompts,
    setKlingElements,
  });

  return {
    sessionId,
    projectRouteRequested,
    selectedTool,
    setSelectedTool,
    mode,
    model,
    setModelState,
    aspect,
    imageResolution,
    setAspect,
    setImageResolution,
    videoReferenceMode,
    setVideoReferenceMode,
    videoResolution,
    setVideoResolution,
    klingWorkflowMode,
    setKlingWorkflowMode,
    klingMultiPrompts,
    setKlingMultiPrompts,
    klingElements,
    setKlingElements,
    ...workflow,
  };
};

describe("useAiStudioWorkflowSettings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults create workflow model to Seedream text-to-image when no saved model exists", async () => {
    window.sessionStorage.clear();

    const { result } = renderHook(() => useHarness("create"));

    await waitFor(() => expect(result.current.mode).toBe("image"));
    expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image");
  });

  it("defaults create workflow model to the edit default when Character Mode is enabled", async () => {
    window.sessionStorage.clear();

    const { result } = renderHook(() => useHarness("create", "session-1", null, false, true));

    await waitFor(() => expect(result.current.mode).toBe("image"));
    expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/edit");
  });

  it("restores saved create video workflow settings from session storage", async () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        create: {
          mode: "video",
          model: "kie-ai/veo-3.1-fast-i2v",
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
          klingWorkflowMode: "custom",
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
    expect(result.current.model).toBe(KIE_VEO_31_FAST_I2V_MODEL_ID);
    expect(result.current.aspect).toBe("16:9");
    expect(result.current.videoResolution).toBe("4k");
    expect(result.current.klingElements).toEqual([]);
  });

  it("canonicalizes hidden keyframes snapshot values onto the visible standard video lane", async () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        video: {
          mode: "video",
          model: KIE_KLING_30_MODEL_ID,
          aspect: "16:9",
          imageResolution: "model_default",
          videoReferenceMode: "keyframes",
          videoDurationSeconds: 8,
          videoResolution: "1080p",
          videoGenerateAudio: true,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "noise",
          klingCfgScale: 0.8,
          klingWorkflowMode: "single",
          seedance2InputMode: "text",
          seedance2ReferenceImageUrls: [],
          seedance2ReferenceVideoUrls: [],
          seedance2ReferenceAudioUrls: [],
          seedance2ReturnLastFrame: false,
          seedance2WebSearch: false,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
        },
      })
    );

    const { result } = renderHook(() => useHarness("video"));

    await waitFor(() => expect(result.current.selectedTool).toBe("video"));
    await waitFor(() => expect(result.current.videoReferenceMode).toBe("standard"));
    expect(result.current.model).toBe(KIE_KLING_30_MODEL_ID);
  });

  it("does not restore workflow settings from session storage while a project route is pending", async () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        create: {
          mode: "video",
          model: KIE_VEO_31_FAST_I2V_MODEL_ID,
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
          klingWorkflowMode: "single",
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
        },
      })
    );

    const { result } = renderHook(() => useHarness("create", "session-1", null, true));

    await waitFor(() => expect(result.current.mode).toBe("text"));
    expect(result.current.aspect).toBe("9:16");
    expect(result.current.videoResolution).toBe("1080p");
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
          klingWorkflowMode: "single",
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

  it("restores a saved character-mode edit model without normalizing it back to text-image", async () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        create: {
          mode: "image",
          model: "fal-ai/bytedance/seedream/v4.5/edit",
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
          klingWorkflowMode: "single",
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
        },
      })
    );

    const { result } = renderHook(() => useHarness("create", "session-1", null, false, true));

    await waitFor(() => expect(result.current.mode).toBe("image"));
    expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/edit");
  });

  it("falls back to Seedream edit when saved edit model is invalid", async () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        edit: {
          mode: "image",
          model: "not-a-real-edit-model-id",
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
          klingWorkflowMode: "single",
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [
            { id: "el-1", frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" },
          ],
        },
      })
    );

    const { result } = renderHook(() => useHarness("edit"));

    await waitFor(() => expect(result.current.selectedTool).toBe("edit"));
    expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/edit");
  });

  it("ignores browser workflow storage when a project workspace is active", async () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        create: {
          mode: "video",
          model: KIE_VEO_31_FAST_I2V_MODEL_ID,
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
          klingWorkflowMode: "custom",
          klingShotType: "intelligent",
          klingVoiceIds: ["a", "b"],
          klingMultiPrompts: [{ id: "shot-1", prompt: "A", duration: 6 }],
          klingElements: [],
        },
      })
    );

    const { result } = renderHook(() => useHarness("create", "session-1", "project-1", true));

    await waitFor(() => expect(result.current.mode).toBe("image"));
    expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image");
    expect(window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY)).toContain('"video"');
  });

  it("keeps Seedance 2 workflow settings active for video tools by default", async () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        video: {
          mode: "video",
          model: KIE_SEEDANCE_2_MODEL_ID,
          aspect: "9:16",
          imageResolution: "model_default",
          videoReferenceMode: "standard",
          videoDurationSeconds: 5,
          videoResolution: "1080p",
          videoGenerateAudio: true,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingWorkflowMode: "single",
          seedance2InputMode: "text",
          seedance2ReferenceImageUrls: [],
          seedance2ReferenceVideoUrls: [],
          seedance2ReferenceAudioUrls: [],
          seedance2ReturnLastFrame: false,
          seedance2WebSearch: false,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
        },
      })
    );

    const { result } = renderHook(() => useHarness("video"));

    await waitFor(() => expect(result.current.selectedTool).toBe("video"));
    expect(result.current.model).toBe(KIE_SEEDANCE_2_MODEL_ID);
  });

  it("keeps Seedance 2 workflow settings on Seedance 2 when the retired rollout flag is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_AI_STUDIO_SEEDANCE_2_ENABLED", "false");
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        video: {
          mode: "video",
          model: KIE_SEEDANCE_2_MODEL_ID,
          aspect: "9:16",
          imageResolution: "model_default",
          videoReferenceMode: "standard",
          videoDurationSeconds: 5,
          videoResolution: "1080p",
          videoGenerateAudio: true,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingWorkflowMode: "single",
          seedance2InputMode: "text",
          seedance2ReferenceImageUrls: [],
          seedance2ReferenceVideoUrls: [],
          seedance2ReferenceAudioUrls: [],
          seedance2ReturnLastFrame: false,
          seedance2WebSearch: false,
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [],
        },
      })
    );

    const { result } = renderHook(() => useHarness("video"));

    await waitFor(() => expect(result.current.selectedTool).toBe("video"));
    expect(result.current.model).toBe(KIE_SEEDANCE_2_MODEL_ID);
  });

  it("restores the saved edit aspect when edit is the active workflow", async () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        edit: {
          mode: "image",
          model: "fal-ai/bytedance/seedream/v4.5/edit",
          aspect: "9:16",
          imageResolution: "model_default",
          videoReferenceMode: "standard",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingWorkflowMode: "single",
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [
            { id: "el-1", frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" },
          ],
        },
      })
    );

    const { result } = renderHook(() => useHarness("edit"));

    await waitFor(() => expect(result.current.selectedTool).toBe("edit"));
    expect(result.current.aspect).toBe("9:16");
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

  it("preserves Kling elements when switching away from and back to video within the same session", async () => {
    window.sessionStorage.clear();
    const { result } = renderHook(() => useHarness("video"));

    await waitFor(() =>
      expect(window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY)).not.toBeNull()
    );
    await waitFor(() => {
      expect(result.current.klingElements).toEqual([]);
    });

    act(() => {
      result.current.setKlingElements([
        { id: "el-1", frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" },
      ]);
    });

    act(() => {
      result.current.setSelectedTool("create");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("create"));

    act(() => {
      result.current.setSelectedTool("video");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("video"));
    expect(result.current.klingElements).toEqual([
      { id: "el-1", frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" },
    ]);

    const raw = window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, { klingElements?: unknown[] }>) : {};
    expect(parsed.video?.klingElements).toEqual([]);
  });

  it("restores in-memory Kling elements on same-session video return even though session storage strips them", async () => {
    window.sessionStorage.clear();
    const { result } = renderHook(() => useHarness("video"));

    await waitFor(() =>
      expect(window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY)).not.toBeNull()
    );

    act(() => {
      result.current.setKlingElements([
        {
          id: "element-1",
          slotIndex: 0,
          sourceKind: "element",
          sourceElementId: "element-beach",
          sourceCharacterId: null,
          name: "Beach",
          alias: "beach",
          frontalImageUrl: "https://example.com/beach-front.png",
          referenceImageUrls: "https://example.com/beach-side.png",
          videoUrl: "",
        },
      ]);
    });

    await waitFor(() => {
      const raw = window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, { klingElements?: unknown[] }>) : {};
      expect(parsed.video?.klingElements).toEqual([]);
    });

    act(() => {
      result.current.setSelectedTool("create");
    });
    await waitFor(() => expect(result.current.selectedTool).toBe("create"));

    act(() => {
      result.current.setSelectedTool("video");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("video"));
    expect(result.current.klingElements).toEqual([
      expect.objectContaining({
        id: "element-1",
        slotIndex: 0,
        name: "Beach",
        alias: "beach",
      }),
    ]);
  });

  it("preserves create selector changes when switching to edit before persistence catches up", async () => {
    window.sessionStorage.clear();
    const { result } = renderHook(() => useHarness("create"));

    await waitFor(() =>
      expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image")
    );

    act(() => {
      result.current.setAspect("16:9");
      result.current.setImageResolution("2k");
      result.current.setSelectedTool("edit");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("edit"));

    act(() => {
      result.current.setSelectedTool("create");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("create"));
    expect(result.current.aspect).toBe("16:9");
    expect(result.current.imageResolution).toBe("2k");
  });

  it("restores the previously selected create model after switching away and back", async () => {
    window.sessionStorage.clear();
    const { result } = renderHook(() => useHarness("create"));

    await waitFor(() =>
      expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image")
    );

    act(() => {
      result.current.setModelState("fal-ai/bytedance/seedream/v5/lite/text-to-image");
      result.current.setSelectedTool("edit");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("edit"));
    await waitFor(() => expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/edit"));

    act(() => {
      result.current.setSelectedTool("create");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("create"));
    expect(result.current.model).toBe("fal-ai/bytedance/seedream/v5/lite/text-to-image");
  });

  it("restores the previously selected create model after switching to video and back", async () => {
    window.sessionStorage.clear();
    const { result } = renderHook(() => useHarness("create"));

    await waitFor(() =>
      expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image")
    );

    act(() => {
      result.current.setModelState("fal-ai/nano-banana-2");
      result.current.setSelectedTool("video");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("video"));

    act(() => {
      result.current.setSelectedTool("create");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("create"));
    expect(result.current.model).toBe("fal-ai/nano-banana-2");
  });

  it("keeps aspect synchronized across create, edit, and video workflow switches on non-project routes", async () => {
    window.sessionStorage.clear();
    const { result } = renderHook(() => useHarness("create"));

    await waitFor(() =>
      expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/text-to-image")
    );

    act(() => {
      result.current.setAspect("16:9");
      result.current.setSelectedTool("edit");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("edit"));
    expect(result.current.aspect).toBe("16:9");

    act(() => {
      result.current.setSelectedTool("video");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("video"));
    expect(result.current.aspect).toBe("16:9");

    act(() => {
      result.current.setSelectedTool("create");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("create"));
    expect(result.current.aspect).toBe("16:9");
  });

  it("restores edit model and aspect on project routes when switching away and back", async () => {
    window.sessionStorage.clear();
    const { result } = renderHook(() => useHarness("edit", "session-1", "project-1", true));

    await waitFor(() => expect(result.current.selectedTool).toBe("edit"));
    await waitFor(() => expect(result.current.model).toBe("fal-ai/bytedance/seedream/v4.5/edit"));

    act(() => {
      result.current.setModelState("fal-ai/nano-banana-2/edit");
      result.current.setAspect("4:5");
      result.current.setSelectedTool("video");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("video"));
    await waitFor(() => expect(result.current.model).toBeNull());

    act(() => {
      result.current.setSelectedTool("edit");
    });

    await waitFor(() => expect(result.current.selectedTool).toBe("edit"));
    expect(result.current.model).toBe("fal-ai/nano-banana-2/edit");
    expect(result.current.aspect).toBe("4:5");
    expect(window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY)).toBeNull();
  });

  it("resets custom Kling multi-shot state when the active video model changes away from Kling", async () => {
    window.sessionStorage.clear();
    const { result } = renderHook(() => useHarness("video"));

    await waitFor(() =>
      expect(window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY)).not.toBeNull()
    );

    act(() => {
      result.current.setModelState(KIE_KLING_30_MODEL_ID);
      result.current.setKlingWorkflowMode("custom");
      result.current.setKlingMultiPrompts([{ id: "shot-1", prompt: "Beat one", duration: 5 }]);
    });

    expect(result.current.klingWorkflowMode).toBe("custom");
    expect(result.current.klingMultiPrompts).toHaveLength(1);

    act(() => {
      result.current.setModelState("kie-ai/veo-3.1-fast-i2v");
    });

    await waitFor(() => {
      expect(result.current.klingWorkflowMode).toBe("single");
      expect(result.current.klingMultiPrompts).toEqual([]);
    });
  });

  it("does not restore persisted Kling elements from workflow session storage", async () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        video: {
          mode: "video",
          model: KIE_KLING_30_MODEL_ID,
          aspect: "9:16",
          imageResolution: "model_default",
          videoReferenceMode: "standard",
          videoDurationSeconds: 6,
          videoResolution: "1080p",
          videoGenerateAudio: false,
          videoCameraFixed: false,
          videoAutoFix: false,
          klingNegativePrompt: "blur",
          klingCfgScale: 0.5,
          klingWorkflowMode: "single",
          klingShotType: "customize",
          klingVoiceIds: ["", ""],
          klingMultiPrompts: [],
          klingElements: [
            {
              id: "el-1",
              frontalImageUrl: "https://example.com/front.png",
              referenceImageUrls: "",
              videoUrl: "",
            },
          ],
        },
      })
    );
    window.sessionStorage.setItem("aiStudioWorkflowSettingsSessionId.v1", "session-old");

    const { result } = renderHook(() => useHarness("video", "session-old"));

    await waitFor(() => expect(result.current.selectedTool).toBe("video"));
    expect(result.current.klingElements).toEqual([]);

    await waitFor(() => {
      const raw = window.sessionStorage.getItem(WORKFLOW_SETTINGS_SESSION_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, { klingElements?: unknown[] }>) : {};
      expect(parsed.video?.klingElements).toEqual([]);
    });
  });
});
