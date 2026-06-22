import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStylesLibraryPanelIdsPreference } from "../useStylesLibraryPanelIdsPreference";

const useResolvedProtectedSessionStateMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: fetchWithAuthMock,
}));

vi.mock("../../../../lib/protectedRouteSessionContext", () => ({
  useResolvedProtectedSessionState: (...args: unknown[]) =>
    useResolvedProtectedSessionStateMock(...args),
}));

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

describe("useStylesLibraryPanelIdsPreference", () => {
  beforeEach(() => {
    useResolvedProtectedSessionStateMock.mockReset();
    fetchWithAuthMock.mockReset();
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
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({ stylePanelIds: ["anime", "photorealistic", "anime", 42] })
    );

    const { result } = renderHook(() => useStylesLibraryPanelIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/ai/style-order", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    expect(result.current.stylePanelIds).toEqual(["anime", "photorealistic"]);
    expect(result.current.syncState).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("persists reordered ids, removes deleted custom styles, and resets through the API route", async () => {
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-123" } } as never,
      user: { id: "user-123" } as never,
    });
    fetchWithAuthMock
      .mockResolvedValueOnce(jsonResponse({ stylePanelIds: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ stylePanelIds: ["cinematic", "anime", "style-library-custom-1"] })
      )
      .mockResolvedValueOnce(jsonResponse({ stylePanelIds: ["cinematic", "anime"] }))
      .mockResolvedValueOnce(jsonResponse({ stylePanelIds: [] }));

    const { result } = renderHook(() => useStylesLibraryPanelIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.setStylePanelIds(["cinematic", "anime", "style-library-custom-1"]);
      await result.current.removeStylePanelId("style-library-custom-1");
      await result.current.resetStylePanelIds();
    });

    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      2,
      "/api/ai/style-order",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          stylePanelIds: ["cinematic", "anime", "style-library-custom-1"],
        }),
      })
    );
    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      3,
      "/api/ai/style-order",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ stylePanelIds: ["cinematic", "anime"] }),
      })
    );
    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      4,
      "/api/ai/style-order",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ stylePanelIds: [] }),
      })
    );
    expect(result.current.stylePanelIds).toEqual([]);
    expect(window.localStorage.getItem("shortpulse.ai_studio.style_panel_ids:user-123")).toBeNull();
  });

  it("rolls back optimistic order when canonical persistence fails", async () => {
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-123" } } as never,
      user: { id: "user-123" } as never,
    });
    fetchWithAuthMock
      .mockResolvedValueOnce(jsonResponse({ stylePanelIds: ["cinematic", "anime"] }))
      .mockResolvedValueOnce(
        jsonResponse({ error: "Failed to save style order." }, { status: 500 })
      );

    const { result } = renderHook(() => useStylesLibraryPanelIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let saved = true;
    await act(async () => {
      saved = await result.current.setStylePanelIds(["anime", "cinematic"]);
    });

    expect(saved).toBe(false);
    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      2,
      "/api/ai/style-order",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ stylePanelIds: ["anime", "cinematic"] }),
      })
    );
    expect(result.current.stylePanelIds).toEqual(["cinematic", "anime"]);
    expect(window.localStorage.getItem("shortpulse.ai_studio.style_panel_ids:user-123")).toBeNull();
    expect(result.current.syncState).toBe("error");
    expect(result.current.error).toBe("Failed to save style order.");
  });

  it("surfaces schema/load errors instead of falling back to legacy storage", async () => {
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-123" } } as never,
      user: { id: "user-123" } as never,
    });
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({ error: "Column ai_studio_style_panel_ids missing" }, { status: 500 })
    );

    const { result } = renderHook(() => useStylesLibraryPanelIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stylePanelIds).toEqual([]);
    expect(result.current.syncState).toBe("error");
    expect(result.current.error).toBe("Column ai_studio_style_panel_ids missing");
  });
});
