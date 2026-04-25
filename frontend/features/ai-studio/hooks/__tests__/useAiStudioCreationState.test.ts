import { renderHook } from "@testing-library/react";
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
});
