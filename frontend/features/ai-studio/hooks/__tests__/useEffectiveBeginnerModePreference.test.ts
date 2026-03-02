/**
 * Wrapper-hook tests for runtime beginner-mode policy enforcement.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const useBeginnerModePreferenceMock = vi.fn();

const restoreEnv = () => {
  Object.keys(process.env).forEach((key) => {
    delete process.env[key];
  });
  Object.assign(process.env, ORIGINAL_ENV);
};

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
    restoreEnv();
    vi.resetModules();
  });

  it("forces expert mode and hides toggle when force-off is active", async () => {
    process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_FORCE_OFF = "true";
    process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_TOGGLE_VISIBLE = "true";

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

  it("passes through stored mode and setter when force-off is disabled and toggle is visible", async () => {
    process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_FORCE_OFF = "false";
    process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_TOGGLE_VISIBLE = "true";

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

    expect(result.current.beginnerMode).toBe(true);
    expect(result.current.showBeginnerModeToggle).toBe(true);
    expect(setStoredBeginnerMode).not.toHaveBeenCalled();

    result.current.setBeginnerMode(false);
    expect(setStoredBeginnerMode).toHaveBeenCalledTimes(1);
    expect(setStoredBeginnerMode).toHaveBeenCalledWith(false);
  });

  it("hides toggle and blocks setter when toggle visibility flag is false", async () => {
    process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_FORCE_OFF = "false";
    process.env.NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_TOGGLE_VISIBLE = "false";

    const setStoredBeginnerMode = vi.fn();
    useBeginnerModePreferenceMock.mockReturnValue({
      beginnerMode: false,
      loading: false,
      error: null,
      syncState: "ready",
      setBeginnerMode: setStoredBeginnerMode,
    });

    const useEffectiveBeginnerModePreference = await loadHook();
    const { result } = renderHook(() => useEffectiveBeginnerModePreference());

    expect(result.current.showBeginnerModeToggle).toBe(false);
    result.current.setBeginnerMode(true);
    expect(setStoredBeginnerMode).not.toHaveBeenCalled();
  });
});
