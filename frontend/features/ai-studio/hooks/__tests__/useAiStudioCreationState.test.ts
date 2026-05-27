import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAiStudioCreationState } from "../useAiStudioCreationState";

describe("useAiStudioCreationState", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("uses sessionStorage defaults on plain session routes", () => {
    window.sessionStorage.setItem("aiStudioVideoDuration", "8");
    window.sessionStorage.setItem("aiStudioVideoResolution", "4k");
    window.sessionStorage.setItem("aiStudioImageResolution", "2048x2048");

    const { result } = renderHook(() => useAiStudioCreationState());

    expect(result.current.videoDurationSeconds).toBe(8);
    expect(result.current.videoResolution).toBe("4k");
    expect(result.current.imageResolution).toBe("2048x2048");
    expect(result.current.hasUserVideoPrefs).toBe(true);
  });

  it("skips sessionStorage-backed creation defaults while a project route is pending", () => {
    window.sessionStorage.setItem("aiStudioVideoDuration", "8");
    window.sessionStorage.setItem("aiStudioVideoResolution", "4k");
    window.sessionStorage.setItem("aiStudioImageResolution", "2048x2048");

    const { result } = renderHook(() =>
      useAiStudioCreationState({
        projectRouteRequested: true,
      })
    );

    expect(result.current.videoDurationSeconds).toBe(6);
    expect(result.current.videoResolution).toBe("1080p");
    expect(result.current.imageResolution).toBe("model_default");
    expect(result.current.hasUserVideoPrefs).toBe(false);
  });

  it("keeps sound workflow durations page-owned with null defaults", () => {
    const { result } = renderHook(() => useAiStudioCreationState());

    expect(result.current.musicDurationSeconds).toBeNull();
    expect(result.current.soundEffectsDurationSeconds).toBeNull();

    act(() => {
      result.current.setMusicDurationSecondsState(180);
      result.current.setSoundEffectsDurationSecondsState(10);
    });

    expect(result.current.musicDurationSeconds).toBe(180);
    expect(result.current.soundEffectsDurationSeconds).toBe(10);
  });

  it("keeps lane busy state active until the last concurrent submission settles", () => {
    const { result } = renderHook(() => useAiStudioCreationState());

    act(() => {
      result.current.beginPanelGeneration("create");
      result.current.beginPanelGeneration("create");
    });
    expect(result.current.createIsGenerating).toBe(true);

    act(() => {
      result.current.endPanelGeneration("create");
    });
    expect(result.current.createIsGenerating).toBe(true);

    act(() => {
      result.current.endPanelGeneration("create");
      result.current.endPanelGeneration("create");
    });
    expect(result.current.createIsGenerating).toBe(false);
  });
});
