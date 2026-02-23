import { describe, expect, it, vi } from "vitest";
import { collectUniqueMediaIds, resolveSignedPreviewUrlsByMediaIds } from "../mediaPreviewResolver";

describe("mediaPreviewResolver", () => {
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
    const fetcher = vi.fn(async () => ({ ok: false }));

    const resolved = await resolveSignedPreviewUrlsByMediaIds({
      ids: ["media-1"],
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(resolved.size).toBe(0);
  });
});
