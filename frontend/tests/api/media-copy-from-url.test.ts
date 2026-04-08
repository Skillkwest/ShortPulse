import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/copy-from-url";

const dnsLookupMock = vi.fn();
const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const resolveMediaPreviewTrustedHostsMock = vi.fn();
const extractImageDimensionsFromBufferMock = vi.fn();
const detectImageMimeTypeMock = vi.fn();
const detectVideoMimeTypeMock = vi.fn();

vi.mock("node:dns/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:dns/promises")>();
  return {
    ...actual,
    default: {
      ...actual,
      lookup: (...args: Parameters<typeof actual.lookup>) => dnsLookupMock(...args),
    },
    lookup: (...args: Parameters<typeof actual.lookup>) => dnsLookupMock(...args),
  };
});

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/mediaPreviewTrustPolicy", () => ({
  resolveMediaPreviewTrustedHosts: (...args: unknown[]) =>
    resolveMediaPreviewTrustedHostsMock(...args),
}));

vi.mock("../../lib/server/imageDimensions", () => ({
  extractImageDimensionsFromBuffer: (...args: unknown[]) =>
    extractImageDimensionsFromBufferMock(...args),
}));

vi.mock("../../lib/server/uploadSignature", () => ({
  detectImageMimeType: (...args: unknown[]) => detectImageMimeTypeMock(...args),
  detectVideoMimeType: (...args: unknown[]) => detectVideoMimeTypeMock(...args),
}));

type MediaInsertRow = {
  id?: string | null;
  storage_path?: string | null;
  file_type?: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
};

type ExistingMediaRow = {
  id: string;
  storage_path: string | null;
  file_type: string | null;
  metadata: Record<string, unknown> | null;
  thumb_variant_path: string | null;
  poster_variant_path: string | null;
  preview_variant_path: string | null;
};

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createSupabaseAdmin = (options?: {
  existingRow?: ExistingMediaRow | null;
  generationOutputRows?: Array<Record<string, unknown>>;
  canonicalOutputMediaFileId?: string | null;
  canonicalOutputMaybeSingleError?: { message?: string } | null;
  insertRow?: MediaInsertRow | null;
  insertError?: { code?: string; message?: string } | null;
  uploadError?: { message: string } | null;
  signedUrls?: Record<string, string>;
  removedPaths?: string[][];
}) => {
  const signedUrls = options?.signedUrls ?? {};
  const uploadMock = vi.fn(async () => ({ error: options?.uploadError ?? null }));
  const removeMock = vi.fn(async (paths: string[]) => {
    options?.removedPaths?.push(paths);
    return { data: null, error: null };
  });
  const createSignedUrlMock = vi.fn(async (path: string) => ({
    data: { signedUrl: signedUrls[path] ?? `https://signed.test/${encodeURIComponent(path)}` },
    error: null,
  }));

  const maybeSingleMock = vi.fn(async () => ({
    data: options?.existingRow ?? null,
    error: null,
  }));

  const singleMock = vi.fn(async () => ({
    data:
      options?.insertError == null
        ? {
            id: "media-new-1",
            storage_path: "user-1/uploads/images/media-new-1.png",
            file_type: "image",
            metadata: {},
            thumb_variant_path: null,
            poster_variant_path: null,
            preview_variant_path: null,
            ...(options?.insertRow ?? {}),
          }
        : null,
    error: options?.insertError ?? null,
  }));

  const generationOutputRows = [...(options?.generationOutputRows ?? [])];
  const generationOutputLimit = vi.fn(async () => ({
    data: generationOutputRows,
    error: null,
  }));
  const generationOutputMaybeSingle = vi.fn(async () => ({
    data:
      options?.canonicalOutputMediaFileId === undefined
        ? null
        : { media_file_id: options.canonicalOutputMediaFileId },
    error: options?.canonicalOutputMaybeSingleError ?? null,
  }));
  const generationOutputUpdateMock = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    })),
  }));
  const generationOutputInsertMock = vi.fn(async () => ({ error: null }));
  const mediaUpdateEqUserMock = vi.fn(async () => ({ error: null }));
  const mediaUpdateEqIdMock = vi.fn(() => ({
    eq: mediaUpdateEqUserMock,
  }));
  const mediaUpdateMock = vi.fn(() => ({
    eq: mediaUpdateEqIdMock,
  }));
  const mediaAssetVariantUpsertMock = vi.fn(async () => ({ error: null }));

  const fromMock = vi.fn((table: string) => {
    if (table === "media_files") {
      const mediaSelectBuilder = {
        eq: vi.fn(),
        contains: vi.fn(),
        limit: vi.fn(),
        maybeSingle: maybeSingleMock,
      };
      mediaSelectBuilder.eq.mockReturnValue(mediaSelectBuilder);
      mediaSelectBuilder.contains.mockReturnValue(mediaSelectBuilder);
      mediaSelectBuilder.limit.mockReturnValue(mediaSelectBuilder);
      return {
        select: vi.fn(() => mediaSelectBuilder),
        update: mediaUpdateMock,
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: singleMock })),
        })),
      };
    }
    if (table === "media_asset_variants") {
      return {
        upsert: mediaAssetVariantUpsertMock,
      };
    }
    if (table === "ai_generation_outputs") {
      return {
        select: vi.fn((fields: string) => {
          if (fields === "media_file_id") {
            const builder = {
              eq: vi.fn(),
              limit: vi.fn(),
              maybeSingle: generationOutputMaybeSingle,
            };
            builder.eq.mockReturnValue(builder);
            builder.limit.mockReturnValue(builder);
            return builder;
          }
          const builder = {
            eq: vi.fn(),
            order: vi.fn(),
            limit: generationOutputLimit,
          };
          builder.eq.mockReturnValue(builder);
          builder.order.mockReturnValue(builder);
          return builder;
        }),
        update: generationOutputUpdateMock,
        insert: generationOutputInsertMock,
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    fromMock,
    uploadMock,
    createSignedUrlMock,
    removeMock,
    generationOutputUpdateMock,
    generationOutputInsertMock,
    mediaUpdateMock,
    mediaUpdateEqIdMock,
    mediaUpdateEqUserMock,
    mediaAssetVariantUpsertMock,
    admin: {
      from: fromMock,
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
          createSignedUrl: createSignedUrlMock,
          remove: removeMock,
        })),
      },
    },
  };
};

describe("POST /api/media/copy-from-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    resolveMediaPreviewTrustedHostsMock.mockReturnValue(["trusted.example.com", "cdn.example.com"]);
    dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34" }]);
    extractImageDimensionsFromBufferMock.mockReturnValue({ width: 1280, height: 720 });
    detectImageMimeTypeMock.mockReturnValue("image/png");
    detectVideoMimeTypeMock.mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("rejects untrusted hosts before any fetch occurs", async () => {
    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: { url: "https://blocked.example.com/private.png" },
    };
    const res = createMockResponse();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: "Untrusted media URL.",
      details: "URL host is not in the trusted media allowlist.",
    });
  });

  it("rejects ai_studio copy requests that do not include a generation id", async () => {
    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/reference.png",
        source: "ai_studio",
        index: 0,
      },
    };
    const res = createMockResponse();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Generated media is missing durable generation tracking.",
    });
  });

  it("persists a durable poster variant when saving a new copied video with a poster hint", async () => {
    detectVideoMimeTypeMock.mockImplementation((buffer: Buffer) =>
      buffer.toString() === "video-buffer" ? "video/mp4" : null
    );
    detectImageMimeTypeMock.mockImplementation((buffer: Buffer) =>
      buffer.toString() === "poster-buffer" ? "image/jpeg" : "image/png"
    );
    extractImageDimensionsFromBufferMock.mockReturnValue({ width: 1280, height: 720 });

    const supabase = createSupabaseAdmin({
      insertRow: {
        id: "media-video-1",
        storage_path: "user-1/generations/videos/media-video-1.mp4",
        file_type: "video",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(Buffer.from("video-buffer"), {
          status: 200,
          headers: { "content-type": "video/mp4" },
        })
      )
      .mockResolvedValueOnce(
        new Response(Buffer.from("poster-buffer"), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/output.mp4",
        source: "ai_studio",
        mode: "video",
        generationId: "gen-1",
        index: 0,
        posterUrlHint: "https://cdn.example.com/poster.jpg",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(supabase.uploadMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^user-1\/generations\/videos\//),
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "video/mp4",
      })
    );
    expect(supabase.uploadMock).toHaveBeenNthCalledWith(
      2,
      "user-1/variants/videos/media-video-1/poster_720.jpg",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      })
    );
    expect(supabase.mediaAssetVariantUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        media_file_id: "media-video-1",
        variant_kind: "poster_720",
        storage_path: "user-1/variants/videos/media-video-1/poster_720.jpg",
      }),
      expect.objectContaining({
        onConflict: "media_file_id,variant_kind",
      })
    );
    expect(supabase.mediaUpdateMock).toHaveBeenCalledWith({
      poster_variant_path: "user-1/variants/videos/media-video-1/poster_720.jpg",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("skips oversized inline poster payloads without failing the main video save", async () => {
    detectVideoMimeTypeMock.mockImplementation((buffer: Buffer) =>
      buffer.toString() === "video-buffer" ? "video/mp4" : null
    );

    const supabase = createSupabaseAdmin({
      insertRow: {
        id: "media-video-oversized-poster",
        storage_path: "user-1/generations/videos/media-video-oversized-poster.mp4",
        file_type: "video",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(Buffer.from("video-buffer"), {
        status: 200,
        headers: { "content-type": "video/mp4" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const oversizedPosterPayload = "A".repeat(35_000_000);
    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/output.mp4",
        source: "ai_studio",
        mode: "video",
        generationId: "gen-oversized-poster",
        index: 0,
        posterUrlHint: `data:image/jpeg;base64,${oversizedPosterPayload}`,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(supabase.uploadMock).toHaveBeenCalledTimes(1);
    expect(supabase.mediaAssetVariantUpsertMock).not.toHaveBeenCalled();
    expect(supabase.mediaUpdateMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileId: "media-video-oversized-poster",
        fileType: "video",
      })
    );
  });

  it("returns an existing ai_studio media row without re-fetching or re-uploading", async () => {
    const supabase = createSupabaseAdmin({
      existingRow: {
        id: "media-existing-1",
        storage_path: "user-1/generations/images/existing.png",
        file_type: "image",
        metadata: { generation_output_index: 0 },
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
      },
      canonicalOutputMediaFileId: "media-existing-1",
      generationOutputRows: [
        {
          id: "gen-output-1",
          output_index: 0,
          result_url: "https://trusted.example.com/reference.png",
          media_file_id: "media-existing-1",
        },
      ],
      signedUrls: {
        "user-1/generations/images/existing.png": "https://signed.test/existing.png",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/reference.png",
        source: "ai_studio",
        generationId: "gen-1",
        index: 0,
        previewUrlHint: "https://cdn.example.com/fallback-preview.png",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(supabase.uploadMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mediaFileId: "media-existing-1",
      storagePath: "user-1/generations/images/existing.png",
      fileType: "image",
      fileSize: 0,
      delivery: {
        previewStoragePath: "user-1/generations/images/existing.png",
        fullStoragePath: "user-1/generations/images/existing.png",
        previewUrl: "https://signed.test/existing.png",
        fullUrl: "https://signed.test/existing.png",
      },
    });
    expect(supabase.generationOutputUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        media_file_id: "media-existing-1",
      })
    );
  });

  it("falls back to legacy metadata-index lookup when canonical output media linkage is absent", async () => {
    const supabase = createSupabaseAdmin({
      existingRow: {
        id: "media-existing-legacy-1",
        storage_path: "user-1/generations/images/existing-legacy.png",
        file_type: "image",
        metadata: { generation_output_index: 0 },
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
      },
      canonicalOutputMediaFileId: null,
      generationOutputRows: [
        {
          id: "gen-output-1",
          output_index: 0,
          result_url: "https://trusted.example.com/reference.png",
          media_file_id: null,
        },
      ],
      signedUrls: {
        "user-1/generations/images/existing-legacy.png": "https://signed.test/existing-legacy.png",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/reference.png",
        source: "ai_studio",
        generationId: "gen-1",
        index: 0,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(supabase.uploadMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileId: "media-existing-legacy-1",
      })
    );
    expect(supabase.generationOutputUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        media_file_id: "media-existing-legacy-1",
      })
    );
  });

  it("fetches, uploads, and links a trusted ai_studio image URL", async () => {
    const supabase = createSupabaseAdmin({
      insertRow: {
        id: "media-generated-1",
        storage_path: "user-1/generations/images/media-generated-1.png",
        file_type: "image",
        metadata: { prompt: "generated reference" },
      },
      signedUrls: {
        "user-1/generations/images/media-generated-1.png":
          "https://signed.test/media-generated-1.png",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "Content-Type": "image/png", "Content-Length": "4" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/generated-reference.png",
        promptText: "generated reference",
        mode: "image",
        source: "ai_studio",
        generationId: "gen-22",
        index: 2,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(supabase.generationOutputInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-22",
        output_index: 2,
        media_file_id: "media-generated-1",
      })
    );
  });

  it("rejects redirect hops that leave the trusted allowlist", async () => {
    const supabase = createSupabaseAdmin();
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://blocked.example.com/redirected.png" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: { url: "https://trusted.example.com/original.png" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: "URL host is not in the trusted media allowlist.",
    });
  });

  it("fetches, uploads, and persists a trusted image URL", async () => {
    const supabase = createSupabaseAdmin({
      insertRow: {
        id: "media-new-1",
        storage_path: "user-1/uploads/images/media-new-1.png",
        file_type: "image",
        metadata: { prompt: "reference image" },
      },
      signedUrls: {
        "user-1/uploads/images/media-new-1.png": "https://signed.test/media-new-1.png",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "Content-Type": "image/png", "Content-Length": "4" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/reference.png",
        promptText: "reference image",
        mode: "image",
        source: "upload",
        index: 0,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledWith("https://trusted.example.com/reference.png", {
      method: "GET",
      redirect: "manual",
      signal: expect.any(AbortSignal),
    });
    expect(supabase.uploadMock).toHaveBeenCalledTimes(1);
    expect(supabase.fromMock).toHaveBeenCalledWith("media_files");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mediaFileId: "media-new-1",
      storagePath: expect.stringMatching(/^user-1\/uploads\/images\//),
      fileType: "image",
      fileSize: 4,
      delivery: {
        previewStoragePath: expect.stringMatching(/^user-1\/uploads\/images\//),
        fullStoragePath: expect.stringMatching(/^user-1\/uploads\/images\//),
        previewUrl: "https://signed.test/media-new-1.png",
        fullUrl: "https://signed.test/media-new-1.png",
      },
    });
  });

  it("rejects oversized responses before buffering the full body", async () => {
    const supabase = createSupabaseAdmin();
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "Content-Type": "image/png", "Content-Length": String(30 * 1024 * 1024) },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: { url: "https://trusted.example.com/too-large.png", mode: "image" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to copy media from URL.",
      details: "Fetched media exceeds size limit.",
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ routeLabel: "media-copy-from-url" })
    );
  });
});
