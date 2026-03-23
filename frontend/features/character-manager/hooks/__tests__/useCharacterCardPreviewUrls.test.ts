import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCharacterCardPreviewUrls } from "../useCharacterCardPreviewUrls";

const getSignedMediaUrlMock = vi.fn();

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: (...args: unknown[]) => getSignedMediaUrlMock(...args),
}));

describe("useCharacterCardPreviewUrls", () => {
  const originalDevicePixelRatio = globalThis.window?.devicePixelRatio;

  beforeEach(() => {
    getSignedMediaUrlMock.mockReset();
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: originalDevicePixelRatio ?? 1,
    });
  });

  it("uses refreshed signed preview URLs after a retry succeeds", async () => {
    getSignedMediaUrlMock.mockResolvedValue("https://signed.example/refreshed.png");

    const { result } = renderHook(() =>
      useCharacterCardPreviewUrls({
        selectedCharacterId: "char-1",
        adaptivePreviewEnabled: false,
        pressureLevel: 0,
      })
    );

    await act(async () => {
      result.current.refreshCardPreviewSignedUrl(
        "user/chars/card.png",
        "https://failed.example/card.png"
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        result.current.resolveCharacterCardPreviewUrl({
          previewUrl: "https://failed.example/card.png",
          storagePath: "user/chars/card.png",
          cardLongEdgePx: 320,
        })
      ).toBe("https://signed.example/refreshed.png");
    });

    expect(getSignedMediaUrlMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user/chars/card.png",
      expiresInSeconds: 3600,
      forceRefresh: true,
    });
  });

  it("limits refresh retries to one attempt per storage path", async () => {
    getSignedMediaUrlMock.mockResolvedValue("https://signed.example/refreshed.png");

    const { result } = renderHook(() =>
      useCharacterCardPreviewUrls({
        selectedCharacterId: "char-1",
        adaptivePreviewEnabled: false,
        pressureLevel: 0,
      })
    );

    await act(async () => {
      result.current.refreshCardPreviewSignedUrl("user/chars/card.png");
      result.current.refreshCardPreviewSignedUrl("user/chars/card.png");
      await Promise.resolve();
    });

    expect(getSignedMediaUrlMock).toHaveBeenCalledTimes(1);
  });

  it("resets retry state when the selected character changes", async () => {
    getSignedMediaUrlMock.mockResolvedValue("https://signed.example/refreshed.png");

    const { result, rerender } = renderHook(
      ({ selectedCharacterId }: { selectedCharacterId: string }) =>
        useCharacterCardPreviewUrls({
          selectedCharacterId,
          adaptivePreviewEnabled: false,
          pressureLevel: 0,
        }),
      {
        initialProps: { selectedCharacterId: "char-1" },
      }
    );

    await act(async () => {
      result.current.refreshCardPreviewSignedUrl("user/chars/card.png");
      await Promise.resolve();
    });
    expect(getSignedMediaUrlMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ selectedCharacterId: "char-2" });
    });

    await act(async () => {
      result.current.refreshCardPreviewSignedUrl("user/chars/card.png");
      await Promise.resolve();
    });
    expect(getSignedMediaUrlMock).toHaveBeenCalledTimes(2);
  });
});
