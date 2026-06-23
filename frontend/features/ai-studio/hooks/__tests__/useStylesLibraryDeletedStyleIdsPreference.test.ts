import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStylesLibraryDeletedStyleIdsPreference } from "../useStylesLibraryDeletedStyleIdsPreference";

const useResolvedProtectedSessionStateMock = vi.hoisted(() => vi.fn());
const supabaseQueryClientMock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("../../../../lib/supabaseClient", () => ({
  supabaseQueryClient: supabaseQueryClientMock,
}));

vi.mock("../../../../lib/protectedRouteSessionContext", () => ({
  useResolvedProtectedSessionState: (...args: unknown[]) =>
    useResolvedProtectedSessionStateMock(...args),
}));

describe("useStylesLibraryDeletedStyleIdsPreference", () => {
  beforeEach(() => {
    useResolvedProtectedSessionStateMock.mockReset();
    supabaseQueryClientMock.from = vi.fn();
    window.localStorage.clear();
  });

  it("stays idle without loading local or remote deleted style ids while disabled", () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.deleted_style_ids:user-123",
      JSON.stringify(["cinematic"])
    );
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-123" } } as never,
      user: { id: "user-123" } as never,
    });

    const { result } = renderHook(() =>
      useStylesLibraryDeletedStyleIdsPreference({ enabled: false })
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.syncState).toBe("ready");
    expect(result.current.deletedStyleIds).toEqual([]);
    expect(supabaseQueryClientMock.from).not.toHaveBeenCalled();
  });

  it("does not hydrate signed-in deleted style ids from global localStorage fallback", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.deleted_style_ids",
      JSON.stringify(["style-a", "style-b"])
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

    const { result } = renderHook(() => useStylesLibraryDeletedStyleIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.deletedStyleIds).toEqual([]);
    expect(window.localStorage.getItem("shortpulse.ai_studio.deleted_style_ids:user-123")).toBe(
      "[]"
    );
  });

  it("drops over-budget deleted style ids while loading local preferences", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.deleted_style_ids",
      JSON.stringify([" style-library-custom-1 ", "x".repeat(161), "style-library-custom-1"])
    );

    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });

    const { result } = renderHook(() => useStylesLibraryDeletedStyleIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.deletedStyleIds).toEqual(["style-library-custom-1"]);
    expect(window.localStorage.getItem("shortpulse.ai_studio.deleted_style_ids")).toBe(
      JSON.stringify(["style-library-custom-1"])
    );
  });

  it("restores deleted style ids by clearing the per-user preference", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-123" } } as never,
      user: { id: "user-123" } as never,
    });
    supabaseQueryClientMock.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { ai_studio_deleted_style_ids: ["cinematic"] },
            error: null,
          }),
        })),
      })),
      upsert: upsertMock,
    }));

    const { result } = renderHook(() => useStylesLibraryDeletedStyleIdsPreference());

    await waitFor(() => {
      expect(result.current.deletedStyleIds).toEqual(["cinematic"]);
    });

    await act(async () => {
      await result.current.restoreDeletedStyleIds();
    });

    expect(result.current.deletedStyleIds).toEqual([]);
    expect(window.localStorage.getItem("shortpulse.ai_studio.deleted_style_ids:user-123")).toBe(
      "[]"
    );
    expect(upsertMock).toHaveBeenCalledWith(
      { user_id: "user-123", ai_studio_deleted_style_ids: [] },
      { onConflict: "user_id" }
    );
  });
});
