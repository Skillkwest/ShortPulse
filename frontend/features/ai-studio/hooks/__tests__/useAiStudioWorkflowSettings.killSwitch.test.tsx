import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { StudioMode, ToolId } from "../../types";

const ORIGINAL_WORKFLOW_SETTINGS_FLAG =
  process.env.NEXT_PUBLIC_AI_STUDIO_WORKFLOW_SETTINGS_PERSIST_ENABLED;

const restoreWorkflowSettingsFlag = () => {
  if (ORIGINAL_WORKFLOW_SETTINGS_FLAG === undefined) {
    delete process.env.NEXT_PUBLIC_AI_STUDIO_WORKFLOW_SETTINGS_PERSIST_ENABLED;
    return;
  }
  process.env.NEXT_PUBLIC_AI_STUDIO_WORKFLOW_SETTINGS_PERSIST_ENABLED =
    ORIGINAL_WORKFLOW_SETTINGS_FLAG;
};

describe("useAiStudioWorkflowSettings kill switch", () => {
  it("skips sessionStorage hydration and restore when persistence is disabled", async () => {
    process.env.NEXT_PUBLIC_AI_STUDIO_WORKFLOW_SETTINGS_PERSIST_ENABLED = "false";
    vi.resetModules();
    const { WORKFLOW_SETTINGS_SESSION_KEY, useAiStudioWorkflowSettings } =
      await import("../useAiStudioWorkflowSettings");

    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      WORKFLOW_SETTINGS_SESSION_KEY,
      JSON.stringify({
        create: {
          mode: "video",
          model: "fal-ai/veo3.1",
          aspect: "16:9",
          imageResolution: "model_default",
          videoReferenceMode: "standard",
          videoDurationSeconds: 8,
          videoResolution: "4k",
          videoGenerateAudio: true,
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

    const { result } = renderHook(() => {
      const [selectedTool] = useState<ToolId | null>("create");
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
        mode,
        model,
        workflow,
      };
    });

    expect(result.current.mode).toBe("text");
    expect(result.current.model).toBeNull();
    expect(result.current.workflow.hasPendingWorkflowRestore).toBe(false);
  });
});

afterEach(() => {
  restoreWorkflowSettingsFlag();
  vi.resetModules();
  window.sessionStorage.clear();
});
