/**
 * Wrapper-hook tests for runtime beginner-mode policy enforcement.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useBeginnerModePreferenceMock = vi.fn();

const loadHook = async () => {
  vi.doMock("../useBeginnerModePreference", () => ({
    useBeginnerModePreference: useBeginnerModePreferenceMock,
  }));
  const mod = await import("../useEffectiveBeginnerModePreference");
  return mod.useEffectiveBeginnerModePreference;
};

describe("useEffectiveBeginnerModePreference", () => {
  beforeEach(() => {
    useBeginnerModePreferenceMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("forces expert mode and hides the beginner toggle in the canonical runtime", async () => {
    const setStoredBeginnerMode = vi.fn();
    useBeginnerModePreferenceMock.mockReturnValue({
      beginnerMode: true,
      loading: false,
      error: null,
      syncState: "ready",
      setBeginnerMode: setStoredBeginnerMode,
    });

    const useEffectiveBeginnerModePreference = await loadHook();
    const { result } = renderHook(() => useEffectiveBeginnerModePreference());

    expect(result.current.beginnerMode).toBe(false);
    expect(result.current.showBeginnerModeToggle).toBe(false);

    await waitFor(() => {
      expect(setStoredBeginnerMode).toHaveBeenCalledTimes(1);
      expect(setStoredBeginnerMode).toHaveBeenCalledWith(false);
    });

    result.current.setBeginnerMode(true);
    expect(setStoredBeginnerMode).toHaveBeenCalledTimes(1);
  });
});
