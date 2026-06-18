import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMediaSignCandidateEntry,
  mapMediaSignResults,
  summarizeMediaSignResults,
} from "../mediaPreviewSigningBatch";

describe("mediaPreviewSigningBatch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("classifies trusted direct durable preview urls as durable candidates", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.test");

    const entry = buildMediaSignCandidateEntry(
      {
        id: "media-1",
        storage_path: "user-1/uploads/images/original.png",
        thumb_variant_path:
          "https://cdn.example.test/media_library/user-1/variants/images/media-1/thumb_480.png",
      },
      "user-1",
      4
    );

    expect(entry.directUrlKind).toBe("durable");
  });

  it("preserves durable resolved-path classification when a direct preview url wins", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.test");

    const row = {
      id: "media-1",
      storage_path: "user-1/uploads/images/original.png",
      thumb_variant_path:
        "https://cdn.example.test/media_library/user-1/variants/images/media-1/thumb_480.png",
    };
    const entry = buildMediaSignCandidateEntry(row, "user-1", 4);

    const results = mapMediaSignResults({
      currentUserId: "user-1",
      entries: [entry],
      rowsById: new Map([[row.id, row]]),
      signedByPath: new Map(),
    });

    expect(results[0]?.signedUrl).toBe(entry.directUrl);
    expect(results[0]?.resolvedPathKind).toBe("durable");
    expect(summarizeMediaSignResults(results).resolvedDurableCount).toBe(1);
  });

  it("preserves original resolved-path classification when a direct original url wins", () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.test");

    const row = {
      id: "media-2",
      storage_path: "https://cdn.example.test/media_library/user-1/uploads/images/original.png",
    };
    const entry = buildMediaSignCandidateEntry(row, "user-1", 4);

    const results = mapMediaSignResults({
      currentUserId: "user-1",
      entries: [entry],
      rowsById: new Map([[row.id, row]]),
      signedByPath: new Map(),
    });

    expect(entry.directUrlKind).toBe("original");
    expect(results[0]?.signedUrl).toBe(entry.directUrl);
    expect(results[0]?.resolvedPathKind).toBe("original");
    expect(summarizeMediaSignResults(results).resolvedOriginalCount).toBe(1);
  });

  it("does not use Supabase render-image direct urls when signing fails", () => {
    const row = {
      id: "media-3",
      storage_path: "user-1/uploads/images/original.png",
    };
    const results = mapMediaSignResults({
      currentUserId: "user-1",
      entries: [
        {
          id: row.id,
          primaryPath: row.storage_path,
          primaryPathKind: "original",
          candidates: [row.storage_path],
          directUrl:
            "https://project.supabase.co/storage/v1/render/image/sign/media_library/user-1/uploads/images/original.png?token=abc&width=320",
          directUrlKind: "original",
        },
      ],
      rowsById: new Map([[row.id, row]]),
      signedByPath: new Map(),
    });

    expect(results[0]?.signedUrl).toBeNull();
    expect(summarizeMediaSignResults(results)).toMatchObject({
      failedCount: 1,
      transformedCount: 0,
    });
  });
});
