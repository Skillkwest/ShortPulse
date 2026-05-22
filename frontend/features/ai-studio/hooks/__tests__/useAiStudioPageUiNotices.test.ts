import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAiStudioPageUiNotices } from "../useAiStudioPageUiNotices";

describe("useAiStudioPageUiNotices", () => {
  it("suppresses Standard-only Create notices while Pulse mode is active", () => {
    const { result } = renderHook(() =>
      useAiStudioPageUiNotices({
        expertCreateMode: "pulse",
        uiNotice: "Add a reference image before generating.",
        mediaAutosaveError: null,
        mediaAutosaveSyncState: "ready",
      })
    );

    expect(result.current.effectiveUiNotice).toBeNull();
  });

  it("preserves non-Standard notices while Pulse mode is active", () => {
    const { result } = renderHook(() =>
      useAiStudioPageUiNotices({
        expertCreateMode: "pulse",
        uiNotice: "Pulse agent route requires an active Pulse runtime context.",
        mediaAutosaveError: null,
        mediaAutosaveSyncState: "ready",
      })
    );

    expect(result.current.effectiveUiNotice).toBe(
      "Pulse agent route requires an active Pulse runtime context."
    );
  });
});
