import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStylesLibraryPanelIdsPreference } from "../useStylesLibraryPanelIdsPreference";

const useResolvedProtectedSessionStateMock = vi.hoisted(() => vi.fn());
const supabaseQueryClientMock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("../../../../lib/supabaseClient", () => ({
  supabaseQueryClient: supabaseQueryClientMock,
}));

vi.mock("../../../../lib/protectedRouteSessionContext", () => ({
  useResolvedProtectedSessionState: (...args: unknown[]) =>
    useResolvedProtectedSessionStateMock(...args),
}));

describe("useStylesLibraryPanelIdsPreference", () => {
  beforeEach(() => {
    useResolvedProtectedSessionStateMock.mockReset();
    supabaseQueryClientMock.from = vi.fn();
    window.localStorage.clear();
  });

  it("loads local style order and becomes ready when no user session exists", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.style_panel_ids",
      JSON.stringify(["anime", "cinematic", "anime", 99])
    );

    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });

    const { result } = renderHook(() => useStylesLibraryPanelIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stylePanelIds).toEqual(["anime", "cinematic"]);
    expect(result.current.syncState).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("persists reordered ids, removes deleted custom styles, and resets local order overrides", async () => {
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });

    const { result } = renderHook(() => useStylesLibraryPanelIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.setStylePanelIds(["cinematic", "anime", "style-library-custom-1"]);
      await result.current.removeStylePanelId("style-library-custom-1");
    });

    expect(result.current.stylePanelIds).toEqual(["cinematic", "anime"]);
    expect(
      JSON.parse(window.localStorage.getItem("shortpulse.ai_studio.style_panel_ids") ?? "[]")
    ).toEqual(["cinematic", "anime"]);

    await act(async () => {
      await result.current.resetStylePanelIds();
    });

    expect(result.current.stylePanelIds).toEqual([]);
    expect(
      JSON.parse(window.localStorage.getItem("shortpulse.ai_studio.style_panel_ids") ?? "[]")
    ).toEqual([]);
  });

  it("does not hydrate signed-in style order from global localStorage fallback", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.style_panel_ids",
      JSON.stringify(["anime", "cinematic"])
    );

    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-123" } } as never,
      user: { id: "user-123" } as never,
    });
    supabaseQueryClientMock.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }));

    const { result } = renderHook(() => useStylesLibraryPanelIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stylePanelIds).toEqual([]);
    expect(window.localStorage.getItem("shortpulse.ai_studio.style_panel_ids:user-123")).toBe("[]");
  });
});
