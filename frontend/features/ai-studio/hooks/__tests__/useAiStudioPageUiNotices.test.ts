import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAiStudioPageUiNotices } from "../useAiStudioPageUiNotices";

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioPageUiNotices>[0]> = {}
): Parameters<typeof useAiStudioPageUiNotices>[0] => ({
  uiNotice: null,
  beginnerModeError: null,
  beginnerModeLoading: false,
  beginnerModeSyncState: "ready",
  showBeginnerModeToggle: true,
  setBeginnerMode: vi.fn(),
  mediaAutosaveError: null,
  mediaAutosaveSyncState: "ready",
  ...overrides,
});

describe("useAiStudioPageUiNotices", () => {
  it("prefers the page ui notice over preference sync notices", () => {
    const { result } = renderHook(() =>
      useAiStudioPageUiNotices(
        createParams({
          uiNotice: "Page notice",
          beginnerModeError: "beginner failed",
          mediaAutosaveError: "autosave failed",
        })
      )
    );

    expect(result.current.effectiveUiNotice).toBe("Page notice");
  });

  it("falls back to beginner mode and media autosave notices in priority order", () => {
    const beginner = renderHook(() =>
      useAiStudioPageUiNotices(
        createParams({
          beginnerModeError: "beginner failed",
          mediaAutosaveError: "autosave failed",
        })
      )
    );
    expect(beginner.result.current.effectiveUiNotice).toBe(
      "Beginner mode preference sync failed: beginner failed"
    );

    const mediaAutosave = renderHook(() =>
      useAiStudioPageUiNotices(
        createParams({
          mediaAutosaveSyncState: "saving",
        })
      )
    );
    expect(mediaAutosave.result.current.effectiveUiNotice).toBe(
      "Saving media autosave preference..."
    );
  });

  it("blocks beginner mode writes while hidden, loading, or saving", () => {
    const setBeginnerMode = vi.fn();
    const hidden = renderHook(() =>
      useAiStudioPageUiNotices(
        createParams({
          showBeginnerModeToggle: false,
          setBeginnerMode,
        })
      )
    );
    hidden.result.current.handleBeginnerModeChange(true);

    const loading = renderHook(() =>
      useAiStudioPageUiNotices(
        createParams({
          beginnerModeLoading: true,
          setBeginnerMode,
        })
      )
    );
    loading.result.current.handleBeginnerModeChange(true);

    const saving = renderHook(() =>
      useAiStudioPageUiNotices(
        createParams({
          beginnerModeSyncState: "saving",
          setBeginnerMode,
        })
      )
    );
    saving.result.current.handleBeginnerModeChange(true);

    expect(setBeginnerMode).not.toHaveBeenCalled();
  });

  it("passes through beginner mode writes when the toggle is visible and ready", () => {
    const setBeginnerMode = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioPageUiNotices(
        createParams({
          setBeginnerMode,
        })
      )
    );

    result.current.handleBeginnerModeChange(true);

    expect(setBeginnerMode).toHaveBeenCalledTimes(1);
    expect(setBeginnerMode).toHaveBeenCalledWith(true);
  });
});
