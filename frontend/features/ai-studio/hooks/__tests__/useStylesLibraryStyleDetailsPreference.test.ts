import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStylesLibraryStyleDetailsPreference } from "../useStylesLibraryStyleDetailsPreference";

const useResolvedProtectedSessionStateMock = vi.hoisted(() => vi.fn());
const supabaseQueryClientMock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("../../../../lib/supabaseClient", () => ({
  supabaseQueryClient: supabaseQueryClientMock,
}));

vi.mock("../../../../lib/protectedRouteSessionContext", () => ({
  useResolvedProtectedSessionState: (...args: unknown[]) =>
    useResolvedProtectedSessionStateMock(...args),
}));

describe("useStylesLibraryStyleDetailsPreference", () => {
  beforeEach(() => {
    vi.useRealTimers();
    useResolvedProtectedSessionStateMock.mockReset();
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

    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });

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

  it("keeps the local style when remote sync times out", async () => {
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
      upsert: vi.fn(() => new Promise(() => undefined)),
    }));

    const { result } = renderHook(() => useStylesLibraryStyleDetailsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let savePromise: Promise<boolean> | null = null;
    await act(async () => {
      savePromise = result.current.upsertStyleDetails("style-library-custom-1", {
        style: "Custom Style 1",
        title: "Custom Style 1",
        referenceImageName: "Custom Style 1",
        stylePrompt: "cinematic glow",
        previewImageUrl: "data:image/jpeg;base64,preview",
      });
    });

    expect(result.current.styleDetailsById["style-library-custom-1"]).toEqual({
      style: "Custom Style 1",
      title: "Custom Style 1",
      referenceImageName: "Custom Style 1",
      stylePrompt: "cinematic glow",
      previewImageUrl: "data:image/jpeg;base64,preview",
    });
    expect(result.current.syncState).toBe("saving");

    let saveResult = false;
    await act(async () => {
      saveResult = await (savePromise as Promise<boolean>);
    });

    expect(saveResult).toBe(true);
    expect(result.current.styleDetailsById["style-library-custom-1"]).toEqual({
      style: "Custom Style 1",
      title: "Custom Style 1",
      referenceImageName: "Custom Style 1",
      stylePrompt: "cinematic glow",
      previewImageUrl: "data:image/jpeg;base64,preview",
    });
    expect(result.current.syncState).toBe("error");
    expect(result.current.error).toContain("Saved locally. Cloud sync timed out");
    expect(
      JSON.parse(
        window.localStorage.getItem("shortpulse.ai_studio.style_details_overrides:user-123") ?? "{}"
      )
    ).toEqual({
      "style-library-custom-1": {
        style: "Custom Style 1",
        title: "Custom Style 1",
        referenceImageName: "Custom Style 1",
        stylePrompt: "cinematic glow",
        previewImageUrl: "data:image/jpeg;base64,preview",
      },
    });
  }, 10_000);

  it("does not hydrate signed-in style details from global localStorage fallback", async () => {
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
      })
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

    const { result } = renderHook(() => useStylesLibraryStyleDetailsPreference());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.styleDetailsById).toEqual({});
    expect(
      window.localStorage.getItem("shortpulse.ai_studio.style_details_overrides:user-123")
    ).toBe("{}");
  });
});
