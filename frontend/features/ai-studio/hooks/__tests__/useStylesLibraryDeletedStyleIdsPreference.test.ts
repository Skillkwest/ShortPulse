import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStylesLibraryDeletedStyleIdsPreference } from "../useStylesLibraryDeletedStyleIdsPreference";
import { readSupabaseUserId } from "../../../../lib/supabaseClient";

const readSupabaseUserIdMock = vi.hoisted(() => vi.fn());
const supabaseQueryClientMock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("../../../../lib/supabaseClient", () => ({
  readSupabaseUserId: readSupabaseUserIdMock,
  supabaseQueryClient: supabaseQueryClientMock,
}));

describe("useStylesLibraryDeletedStyleIdsPreference", () => {
  beforeEach(() => {
    vi.mocked(readSupabaseUserId).mockReset();
    supabaseQueryClientMock.from = vi.fn();
    window.localStorage.clear();
  });

  it("does not hydrate signed-in deleted style ids from global localStorage fallback", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.deleted_style_ids",
      JSON.stringify(["style-a", "style-b"])
    );

    vi.mocked(readSupabaseUserId).mockResolvedValue("user-123");
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
});
