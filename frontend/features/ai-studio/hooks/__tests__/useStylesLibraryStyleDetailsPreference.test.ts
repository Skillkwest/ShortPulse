import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStylesLibraryStyleDetailsPreference } from "../useStylesLibraryStyleDetailsPreference";
import { readSupabaseUserId } from "../../../../lib/supabaseClient";

const readSupabaseUserIdMock = vi.hoisted(() => vi.fn());
const supabaseQueryClientMock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("../../../../lib/supabaseClient", () => ({
  readSupabaseUserId: readSupabaseUserIdMock,
  supabaseQueryClient: supabaseQueryClientMock,
}));

describe("useStylesLibraryStyleDetailsPreference", () => {
  beforeEach(() => {
    vi.mocked(readSupabaseUserId).mockReset();
    supabaseQueryClientMock.from = vi.fn();
    window.localStorage.clear();
  });

  it("removes a deleted custom style from the persisted details map", async () => {
    window.localStorage.setItem(
      "shortpulse.ai_studio.style_details_overrides",
      JSON.stringify({
        cinematic: {
          style: "Cinematic",
          title: "Cinematic",
          referenceImageName: "Cinematic",
          stylePrompt: "cinematic prompt",
          previewImageUrl: "data:image/png;base64,cinematic",
        },
        "style-library-custom-1": {
          style: "Custom Style 1",
          title: "Custom Style 1",
          referenceImageName: "Custom Style 1",
          stylePrompt: "custom prompt",
          previewImageUrl: "data:image/png;base64,custom",
        },
      })
    );

    vi.mocked(readSupabaseUserId).mockResolvedValue(null);

    const { result } = renderHook(() => useStylesLibraryStyleDetailsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteStyleDetails("style-library-custom-1");
    });

    expect(result.current.styleDetailsById).toEqual({
      cinematic: {
        style: "Cinematic",
        title: "Cinematic",
        referenceImageName: "Cinematic",
        stylePrompt: "cinematic prompt",
        previewImageUrl: "data:image/png;base64,cinematic",
      },
    });
    expect(
      JSON.parse(
        window.localStorage.getItem("shortpulse.ai_studio.style_details_overrides") ?? "{}"
      )
    ).toEqual({
      cinematic: {
        style: "Cinematic",
        title: "Cinematic",
        referenceImageName: "Cinematic",
        stylePrompt: "cinematic prompt",
        previewImageUrl: "data:image/png;base64,cinematic",
      },
    });
  });
});
