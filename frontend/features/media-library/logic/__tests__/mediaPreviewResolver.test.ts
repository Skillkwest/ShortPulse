import { describe, expect, it, vi } from "vitest";
import {
  collectUniqueMediaIds,
  resolveSignedPreviewUrlsByMediaIds,
  resolveSignedSelectionUrl,
} from "../mediaPreviewResolver";

const { createMediaPerfTimerMock } = vi.hoisted(() => ({
  createMediaPerfTimerMock: vi.fn(),
}));

vi.mock("../../../../lib/mediaPerfTelemetry", () => ({
  createMediaPerfTimer: createMediaPerfTimerMock,
}));

describe("mediaPreviewResolver", () => {
  it("logs resolve-previews completion telemetry", async () => {
    const finishResolvePreviews = vi.fn();
    createMediaPerfTimerMock.mockReturnValue(finishResolvePreviews);
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        urls: {
          "media-1": "https://signed.example.com/1",
          "media-2": null,
        },
      }),
    }));

    const resolved = await resolveSignedPreviewUrlsByMediaIds({
      ids: ["media-1", "media-2"],
      surface: "media-library-panel",
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(Array.from(resolved.entries())).toEqual([["media-1", "https://signed.example.com/1"]]);
    expect(createMediaPerfTimerMock).toHaveBeenCalledWith({
      surface: "media-library-panel",
      batch_size: 2,
    });
    expect(finishResolvePreviews).toHaveBeenCalledWith("media.resolve_previews.completed", {
      resolved_count: 1,
      failed_count: 1,
    });
  });

  it("collects stable unique media ids from rows", () => {
    const ids = collectUniqueMediaIds([
      { id: " media-1 " },
      { id: "media-2" },
      { id: "media-1" },
      { id: "" },
      { id: null },
      {},
    ]);

    expect(ids).toEqual(["media-1", "media-2"]);
  });

  it("resolves signed preview urls by media id", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        urls: {
          "media-1": "https://signed.example.com/1",
          "media-2": null,
          "media-3": "https://signed.example.com/3",
        },
      }),
    }));

    const resolved = await resolveSignedPreviewUrlsByMediaIds({
      ids: ["media-1", "media-2", "media-3"],
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/media/resolve-previews",
      expect.objectContaining({ method: "POST" })
    );
    expect(Array.from(resolved.entries())).toEqual([
      ["media-1", "https://signed.example.com/1"],
      ["media-3", "https://signed.example.com/3"],
    ]);
  });

  it("returns empty map when resolver request fails", async () => {
    const finishResolvePreviews = vi.fn();
    createMediaPerfTimerMock.mockReturnValue(finishResolvePreviews);
    const fetcher = vi.fn(async () => ({ ok: false }));

    const resolved = await resolveSignedPreviewUrlsByMediaIds({
      ids: ["media-1"],
      surface: "media-library-panel",
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(resolved.size).toBe(0);
    expect(finishResolvePreviews).toHaveBeenCalledWith("media.resolve_previews.failed", {
      failed_count: 1,
      error_kind: "http_error",
    });
  });

  it("resolves selection URL with canonical path priority and fallback", async () => {
    const signStoragePath = vi
      .fn<(storagePath: string, options?: { forceRefresh?: boolean }) => Promise<string | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("https://signed.example.com/thumb");

    const resolved = await resolveSignedSelectionUrl({
      row: {
        storage_path: "user-1/media/full.jpg",
        thumb_variant_path: "user-1/media/thumb.jpg",
        file_type: "image/jpeg",
      },
      currentUserId: "user-1",
      signStoragePath,
    });

    expect(resolved).toBe("https://signed.example.com/thumb");
    expect(signStoragePath).toHaveBeenNthCalledWith(1, "user-1/media/full.jpg", {
      forceRefresh: true,
    });
    expect(signStoragePath).toHaveBeenNthCalledWith(2, "user-1/media/thumb.jpg", {
      forceRefresh: true,
    });
  });

  it("dedupes candidate paths when resolving selection URL", async () => {
    const signStoragePath = vi.fn(async () => "https://signed.example.com/full");

    const resolved = await resolveSignedSelectionUrl({
      row: {
        storage_path: "user-1/media/full.jpg",
        file_type: "image/jpeg",
      },
      currentUserId: null,
      signStoragePath,
    });

    expect(resolved).toBe("https://signed.example.com/full");
    expect(signStoragePath).toHaveBeenCalledTimes(1);
    expect(signStoragePath).toHaveBeenCalledWith("user-1/media/full.jpg", { forceRefresh: true });
  });

  it("falls back to trusted direct preview urls when signing fails", async () => {
    const signStoragePath = vi.fn(async () => null);

    const resolved = await resolveSignedSelectionUrl({
      row: {
        storage_path:
          "http://localhost/storage/v1/object/public/media_library/user-1/media/full.jpg",
        thumb_variant_path:
          "http://localhost/storage/v1/object/public/media_library/user-1/media/thumb.jpg",
        file_type: "image/jpeg",
      },
      currentUserId: "user-1",
      signStoragePath,
    });

    expect(resolved).toBe(
      "http://localhost/storage/v1/object/public/media_library/user-1/media/thumb.jpg"
    );
    expect(signStoragePath).toHaveBeenCalledTimes(3);
  });
});
