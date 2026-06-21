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

  it("loads canonical remote style order and ignores legacy localStorage values", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.style_panel_ids:user-123",
      JSON.stringify(["cinematic", "anime"])
    );
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-123" } } as never,
      user: { id: "user-123" } as never,
    });
    supabaseQueryClientMock.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { ai_studio_style_panel_ids: ["anime", "photorealistic", "anime", 42] },
            error: null,
          }),
        })),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }));

    const { result } = renderHook(() => useStylesLibraryPanelIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stylePanelIds).toEqual(["anime", "photorealistic"]);
    expect(result.current.syncState).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("persists reordered ids, removes deleted custom styles, and resets through Supabase", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
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
      upsert,
    }));

    const { result } = renderHook(() => useStylesLibraryPanelIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.setStylePanelIds(["cinematic", "anime", "style-library-custom-1"]);
      await result.current.removeStylePanelId("style-library-custom-1");
      await result.current.resetStylePanelIds();
    });

    expect(upsert).toHaveBeenNthCalledWith(
      1,
      {
        user_id: "user-123",
        ai_studio_style_panel_ids: ["cinematic", "anime", "style-library-custom-1"],
      },
      { onConflict: "user_id" }
    );
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      { user_id: "user-123", ai_studio_style_panel_ids: ["cinematic", "anime"] },
      { onConflict: "user_id" }
    );
    expect(upsert).toHaveBeenNthCalledWith(
      3,
      { user_id: "user-123", ai_studio_style_panel_ids: [] },
      { onConflict: "user_id" }
    );
    expect(result.current.stylePanelIds).toEqual([]);
    expect(window.localStorage.getItem("shortpulse.ai_studio.style_panel_ids:user-123")).toBeNull();
  });

  it("rolls back optimistic order when canonical persistence fails", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: new Error("RLS rejected write") });
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-123" } } as never,
      user: { id: "user-123" } as never,
    });
    supabaseQueryClientMock.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { ai_studio_style_panel_ids: ["cinematic", "anime"] },
            error: null,
          }),
        })),
      })),
      upsert,
    }));

    const { result } = renderHook(() => useStylesLibraryPanelIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let saved = true;
    await act(async () => {
      saved = await result.current.setStylePanelIds(["anime", "cinematic"]);
    });

    expect(saved).toBe(false);
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-123", ai_studio_style_panel_ids: ["anime", "cinematic"] },
      { onConflict: "user_id" }
    );
    expect(result.current.stylePanelIds).toEqual(["cinematic", "anime"]);
    expect(window.localStorage.getItem("shortpulse.ai_studio.style_panel_ids:user-123")).toBeNull();
    expect(result.current.syncState).toBe("error");
    expect(result.current.error).toBe("RLS rejected write");
  });

  it("surfaces schema/load errors instead of falling back to legacy storage", async () => {
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-123" } } as never,
      user: { id: "user-123" } as never,
    });
    supabaseQueryClientMock.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST204", message: "Column ai_studio_style_panel_ids missing" },
          }),
        })),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }));

    const { result } = renderHook(() => useStylesLibraryPanelIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stylePanelIds).toEqual([]);
    expect(result.current.syncState).toBe("error");
    expect(result.current.error).toBe("Column ai_studio_style_panel_ids missing");
  });
});
