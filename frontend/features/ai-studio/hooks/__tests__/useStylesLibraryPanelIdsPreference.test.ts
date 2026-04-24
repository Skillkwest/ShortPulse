import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStylesLibraryPanelIdsPreference } from "../useStylesLibraryPanelIdsPreference";
import { readSupabaseUserId } from "../../../../lib/supabaseClient";

const readSupabaseUserIdMock = vi.hoisted(() => vi.fn());
const supabaseQueryClientMock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("../../../../lib/supabaseClient", () => ({
  readSupabaseUserId: readSupabaseUserIdMock,
  supabaseQueryClient: supabaseQueryClientMock,
}));

describe("useStylesLibraryPanelIdsPreference", () => {
  beforeEach(() => {
    vi.mocked(readSupabaseUserId).mockReset();
    supabaseQueryClientMock.from = vi.fn();
    window.localStorage.clear();
  });

  it("loads local style order and becomes ready when no user session exists", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.style_panel_ids",
      JSON.stringify(["anime", "cinematic", "anime", 99])
    );

    vi.mocked(readSupabaseUserId).mockResolvedValue(null);

    const { result } = renderHook(() => useStylesLibraryPanelIdsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stylePanelIds).toEqual(["anime", "cinematic"]);
    expect(result.current.syncState).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("persists reordered ids and supports removing a deleted custom style locally", async () => {
    vi.mocked(readSupabaseUserId).mockResolvedValue(null);

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
  });
});
