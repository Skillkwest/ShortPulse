import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/copy-from-url";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const dnsLookupMock = vi.fn();
const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const assertPaidMediaLibraryAccessMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const resolveMediaPreviewTrustedHostsMock = vi.fn();
const extractImageDimensionsFromBufferMock = vi.fn();
const detectImageMimeTypeMock = vi.fn();
const detectVideoMimeTypeMock = vi.fn();
const detectAudioMimeTypeMock = vi.fn();
const admitImageBufferForProductUseMock = vi.fn();
const upsertVideoPosterVariantFromBufferMock = vi.fn();
const upsertVideoPreviewVariantFromBufferMock = vi.fn();

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

vi.mock("../../lib/server/api/mediaLibraryPaidAccess", async () => {
  const actual = await vi.importActual<
    typeof import("../../lib/server/api/mediaLibraryPaidAccess")
  >("../../lib/server/api/mediaLibraryPaidAccess");
  return {
    ...actual,
    assertPaidMediaLibraryAccess: (...args: unknown[]) => assertPaidMediaLibraryAccessMock(...args),
  };
});

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/mediaPreviewTrustPolicy", () => ({
  isSupabaseRenderImageUrl: () => false,
  resolveMediaPreviewTrustedHosts: (...args: unknown[]) =>
    resolveMediaPreviewTrustedHostsMock(...args),
}));

vi.mock("../../lib/server/imageDimensions", () => ({
  extractImageDimensionsFromBuffer: (...args: unknown[]) =>
    extractImageDimensionsFromBufferMock(...args),
}));

vi.mock("../../lib/server/imageAdmission", () => ({
  admitImageBufferForProductUse: (...args: unknown[]) => admitImageBufferForProductUseMock(...args),
}));

vi.mock("../../lib/server/uploadSignature", () => ({
  detectAudioMimeType: (...args: unknown[]) => detectAudioMimeTypeMock(...args),
  detectImageMimeType: (...args: unknown[]) => detectImageMimeTypeMock(...args),
  detectVideoMimeType: (...args: unknown[]) => detectVideoMimeTypeMock(...args),
}));

vi.mock("../../lib/server/videoPosterVariant", () => ({
  upsertVideoPosterVariantFromBuffer: (...args: unknown[]) =>
    upsertVideoPosterVariantFromBufferMock(...args),
  upsertVideoPreviewVariantFromBuffer: (...args: unknown[]) =>
    upsertVideoPreviewVariantFromBufferMock(...args),
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
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createSupabaseAdmin = (options?: {
  existingRow?: ExistingMediaRow | null;
  generationOutputRows?: Array<Record<string, unknown>>;
  generationProjectionRow?: Record<string, unknown> | null;
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
  const mediaRows: Array<Record<string, unknown>> = [];
  if (options?.existingRow) {
    mediaRows.push({
      id: options.existingRow.id,
      storage_path: options.existingRow.storage_path,
      file_type: options.existingRow.file_type,
      poster_variant_path: options.existingRow.poster_variant_path,
      preview_variant_path: options.existingRow.preview_variant_path,
    });
  }

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
  const generationOutputUpdateMock = vi.fn((payload: Record<string, unknown>) => ({
    eq: vi.fn((column: string, rowId: string) => ({
      eq: vi.fn(async () => {
        if (column === "id") {
          const targetRow = generationOutputRows.find(
            (row) =>
              row &&
              typeof row === "object" &&
              !Array.isArray(row) &&
              String((row as Record<string, unknown>).id ?? "") === rowId
          );
          if (targetRow && typeof targetRow === "object" && !Array.isArray(targetRow)) {
            (targetRow as Record<string, unknown>).media_file_id = payload.media_file_id ?? null;
          }
        }
        return { error: null };
      }),
    })),
  }));
  const generationOutputInsertMock = vi.fn(async (payload: Record<string, unknown>) => {
    generationOutputRows.push({
      id: `gen-output-${generationOutputRows.length + 1}`,
      output_index: payload.output_index,
      result_url: payload.result_url,
      media_file_id: payload.media_file_id ?? null,
    });
    return { error: null };
  });
  const generationProjectionMaybeSingle = vi.fn(async () => ({
    data: options?.generationProjectionRow ?? null,
    error: null,
  }));
  const mediaUpdateEqUserMock = vi.fn(
    async (): Promise<{ error: { message: string } | null }> => ({ error: null })
  );
  const mediaUpdateEqIdMock = vi.fn(() => ({
    eq: mediaUpdateEqUserMock,
  }));
  const mediaUpdateMock = vi.fn(() => ({
    eq: mediaUpdateEqIdMock,
  }));
  const mediaAssetVariantUpsertMock = vi.fn(async () => ({ error: null }));
  const mediaEventsInsertMock = vi.fn(async () => ({ error: null }));
  const generationPublicationUpsertMock = vi.fn(async () => ({ error: null }));
  const generationProjectionUpsertMock = vi.fn(async () => ({ error: null }));

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
      const mediaListBuilder = {
        eq: vi.fn(),
        in: vi.fn(),
        limit: vi.fn(async () => ({
          data: [...mediaRows],
          error: null,
        })),
      };
      mediaListBuilder.eq.mockReturnValue(mediaListBuilder);
      mediaListBuilder.in.mockReturnValue(mediaListBuilder);
      const detailedSelectDispatcher = {
        eq: vi.fn(() => mediaSelectBuilder),
        in: vi.fn(() => mediaListBuilder),
      };
      return {
        select: vi.fn((fields: string) => {
          if (fields === "id, storage_path") {
            return mediaListBuilder;
          }
          if (
            fields ===
            "id, storage_path, file_type, metadata, thumb_variant_path, poster_variant_path, preview_variant_path"
          ) {
            return detailedSelectDispatcher;
          }
          if (
            fields ===
            "id, storage_path, file_type, thumb_variant_path, poster_variant_path, preview_variant_path"
          ) {
            return mediaListBuilder;
          }
          return mediaSelectBuilder;
        }),
        update: mediaUpdateMock,
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => {
              const response = await singleMock();
              const insertedRow =
                response.data && typeof response.data === "object" && !Array.isArray(response.data)
                  ? (response.data as Record<string, unknown>)
                  : null;
              if (insertedRow?.id && insertedRow?.storage_path) {
                mediaRows.push({
                  id: insertedRow.id,
                  storage_path: insertedRow.storage_path,
                  file_type: insertedRow.file_type,
                  poster_variant_path: insertedRow.poster_variant_path,
                  preview_variant_path: insertedRow.preview_variant_path,
                });
              }
              return response;
            }),
          })),
        })),
      };
    }
    if (table === "media_asset_variants") {
      return {
        upsert: mediaAssetVariantUpsertMock,
      };
    }
    if (table === "media_events") {
      return {
        insert: mediaEventsInsertMock,
      };
    }
    if (table === "ai_generation_outputs") {
      const generationOutputListBuilder = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: generationOutputLimit,
      };
      generationOutputListBuilder.eq.mockReturnValue(generationOutputListBuilder);
      generationOutputListBuilder.order.mockReturnValue(generationOutputListBuilder);
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
          if (
            fields === "output_index, result_url" ||
            fields === "id, output_index, result_url, media_file_id"
          ) {
            return generationOutputListBuilder;
          }
          return generationOutputListBuilder;
        }),
        update: generationOutputUpdateMock,
        insert: generationOutputInsertMock,
        upsert: vi.fn(() => ({
          select: vi.fn(async () => ({
            data: generationOutputRows,
            error: null,
          })),
        })),
      };
    }
    if (table === "generation_publications") {
      return {
        upsert: generationPublicationUpsertMock,
      };
    }
    if (table === "generation_projection") {
      return {
        select: vi.fn(() => {
          const builder = {
            eq: vi.fn(),
            limit: vi.fn(),
            maybeSingle: generationProjectionMaybeSingle,
          };
          builder.eq.mockReturnValue(builder);
          builder.limit.mockReturnValue(builder);
          return builder;
        }),
        upsert: generationProjectionUpsertMock,
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
    mediaEventsInsertMock,
    generationPublicationUpsertMock,
    generationProjectionUpsertMock,
    mediaMaybeSingleMock: maybeSingleMock,
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
    resetApiRateLimitForTests();
    upsertVideoPosterVariantFromBufferMock.mockResolvedValue(null);
    upsertVideoPreviewVariantFromBufferMock.mockResolvedValue(null);
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    assertPaidMediaLibraryAccessMock.mockResolvedValue(undefined);
    resolveMediaPreviewTrustedHostsMock.mockReturnValue(["trusted.example.com", "cdn.example.com"]);
    dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34" }]);
    extractImageDimensionsFromBufferMock.mockReturnValue({ width: 1280, height: 720 });
    detectImageMimeTypeMock.mockReturnValue("image/png");
    detectVideoMimeTypeMock.mockReturnValue(null);
    detectAudioMimeTypeMock.mockReturnValue(null);
    admitImageBufferForProductUseMock.mockImplementation(
      async ({ buffer, mimeType }: { buffer: Buffer; mimeType: string }) => ({
        status: "not_required",
        buffer,
        dimensions: { width: 1280, height: 720 },
        mimeType,
        metadata: {
          version: 1,
          status: "not_required",
          policy: "shortpulse_image_admission_25mb",
          max_bytes: 25 * 1024 * 1024,
          target_bytes: 23 * 1024 * 1024,
          original_bytes: buffer.byteLength,
          admitted_bytes: buffer.byteLength,
          original_mime_type: mimeType,
          admitted_mime_type: mimeType,
          original_width: 1280,
          original_height: 720,
          admitted_width: 1280,
          admitted_height: 720,
          strategy: "passthrough",
          original_preserved: false,
          original_storage_path: null,
          admitted_storage_path: null,
          supabase_transform_used: false,
        },
      })
    );
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

  it("logs auth verifier failures before rate limiting, fetch, or storage work", async () => {
    const authError = new Error("auth verifier exploded");
    requireApiUserMock.mockRejectedValueOnce(authError);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      socket: { remoteAddress: "127.0.0.1" },
      body: { url: "https://trusted.example.com/reference.png", mode: "image" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: authError,
        routeLabel: "media-copy-from-url.auth",
        scope: "app",
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to copy media from URL." });
  });

  it("rejects media copy requests before fetch when paid media access is missing", async () => {
    const { MediaLibraryPaidAccessError } =
      await import("../../lib/server/api/mediaLibraryPaidAccess");
    assertPaidMediaLibraryAccessMock.mockRejectedValueOnce(new MediaLibraryPaidAccessError());
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      socket: { remoteAddress: "127.0.0.1" },
      body: { url: "https://trusted.example.com/reference.png", mode: "image" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(assertPaidMediaLibraryAccessMock).toHaveBeenCalledWith("user-1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      error: "Choose a plan to add media to your Reference Grid and Media Library.",
    });
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

  it("rejects ai_studio copy requests when the trusted URL does not belong to the requested generation output", async () => {
    const supabase = createSupabaseAdmin({
      generationOutputRows: [
        {
          id: "gen-output-mismatch-1",
          output_index: 0,
          result_url: "https://trusted.example.com/owned-reference.png",
          media_file_id: null,
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/foreign-reference.png",
        source: "ai_studio",
        generationId: "gen-mismatch-1",
        index: 0,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: "URL does not belong to the requested generation output.",
    });
  });

  it("does not let caller-provided storage hints authorize an ai_studio source URL", async () => {
    const forgedStoragePath = "user-1/generations/images/forged-preview.png";
    const supabase = createSupabaseAdmin({
      generationOutputRows: [
        {
          id: "gen-output-authorized-1",
          output_index: 0,
          result_url: "https://trusted.example.com/authorized-output.png",
          media_file_id: null,
        },
      ],
      generationProjectionRow: {
        preview_url: "https://trusted.example.com/authorized-output.png",
        result_urls: ["https://trusted.example.com/authorized-output.png"],
        preview_storage_path: null,
        full_storage_path: null,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: `https://trusted.example.com/storage/v1/object/sign/media_library/${forgedStoragePath}`,
        source: "ai_studio",
        generationId: "gen-forged-hint-1",
        index: 0,
        previewStoragePathHint: forgedStoragePath,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: "URL does not belong to the requested generation output.",
    });
  });

  it("allows owned AI Studio provider media URLs without enabling direct external previews", async () => {
    const providerResultUrl = "https://tempfile.aiquickdraw.com/gpt-image-2-kie/output.png";
    const supabase = createSupabaseAdmin({
      generationOutputRows: [
        {
          id: "gen-output-provider-media-1",
          output_index: 0,
          result_url: providerResultUrl,
          media_file_id: null,
        },
      ],
      insertRow: {
        id: "media-provider-media-1",
        storage_path: "user-1/generations/images/media-provider-media-1.png",
        file_type: "image",
      },
      signedUrls: {
        "user-1/generations/images/media-provider-media-1.png":
          "https://signed.test/provider-media.png",
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
        url: providerResultUrl,
        source: "ai_studio",
        provider: "kie",
        modelId: "kie-ai/gpt-image-2",
        generationId: "gen-provider-media-1",
        index: 0,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledWith(providerResultUrl, expect.any(Object));
    expect(supabase.uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/generations\/images\//),
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/png",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileId: "media-provider-media-1",
        fileType: "image",
        delivery: expect.objectContaining({
          previewUrl: "https://signed.test/provider-media.png",
          fullUrl: "https://signed.test/provider-media.png",
        }),
      })
    );
  });

  it("copies remote audio URLs as durable audio media", async () => {
    const supabase = createSupabaseAdmin({
      insertRow: {
        id: "media-audio-copy-1",
        storage_path: "user-1/uploads/audio/media-audio-copy-1.mp3",
        file_type: "audio",
      },
      signedUrls: {
        "user-1/uploads/audio/media-audio-copy-1.mp3": "https://signed.test/audio-copy.mp3",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from("audio-buffer"), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg", "Content-Length": "12" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/reference-voice.mp3",
        mode: "audio",
        fileTypeHint: "audio",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://trusted.example.com/reference-voice.mp3",
      expect.any(Object)
    );
    expect(supabase.uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/uploads\/audio\//),
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "audio/mpeg",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileId: "media-audio-copy-1",
        storagePath: expect.stringMatching(/^user-1\/uploads\/audio\/.+\.mp3$/),
        fileType: "audio",
        delivery: expect.objectContaining({
          fullUrl: "https://signed.test/audio-copy.mp3",
        }),
      })
    );
  });

  it("rejects out-of-scope storage path hints before signing or persistence", async () => {
    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/reference.png",
        previewStoragePathHint: "user-2/generations/images/foreign-preview.png",
      },
    };
    const res = createMockResponse();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid preview storage path hint.",
      details: "Preview storage path hint: must start with 'user-1/'.",
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
      generationOutputRows: [
        {
          id: "gen-output-video-1",
          output_index: 0,
          result_url: "https://trusted.example.com/output.mp4",
          media_file_id: null,
        },
      ],
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

  it("registers a durable preview-loop variant when a copied video provides a distinct preview path", async () => {
    detectVideoMimeTypeMock.mockImplementation((buffer: Buffer) =>
      buffer.toString() === "video-buffer" ? "video/mp4" : null
    );

    const supabase = createSupabaseAdmin({
      generationOutputRows: [
        {
          id: "gen-output-preview-1",
          output_index: 0,
          result_url: "https://trusted.example.com/output.mp4",
          media_file_id: null,
        },
      ],
      insertRow: {
        id: "media-video-preview-1",
        storage_path: "user-1/generations/videos/media-video-preview-1.mp4",
        file_type: "video",
        metadata: {},
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(Buffer.from("video-buffer"), {
          status: 200,
          headers: { "content-type": "video/mp4" },
        })
      )
    );

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/output.mp4",
        source: "ai_studio",
        mode: "video",
        generationId: "gen-preview-1",
        index: 0,
        previewStoragePathHint:
          "user-1/variants/videos/media-video-preview-1/preview_loop_360p.mp4",
        fullStoragePathHint: "user-1/generations/videos/media-video-preview-1.mp4",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(supabase.mediaAssetVariantUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        media_file_id: "media-video-preview-1",
        variant_kind: "preview_loop_360p",
        storage_path: "user-1/variants/videos/media-video-preview-1/preview_loop_360p.mp4",
        mime_type: "video/mp4",
      }),
      expect.objectContaining({
        onConflict: "media_file_id,variant_kind",
      })
    );
    expect(supabase.mediaUpdateMock).toHaveBeenCalledWith({
      preview_variant_path: "user-1/variants/videos/media-video-preview-1/preview_loop_360p.mp4",
    });
    expect(supabase.uploadMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("logs a variant_hydration_failed event when copied video preview persistence fails", async () => {
    detectVideoMimeTypeMock.mockImplementation((buffer: Buffer) =>
      buffer.toString() === "video-buffer" ? "video/mp4" : null
    );

    const supabase = createSupabaseAdmin({
      generationOutputRows: [
        {
          id: "gen-output-preview-failed-1",
          output_index: 0,
          result_url: "https://trusted.example.com/output.mp4",
          media_file_id: null,
        },
      ],
      insertRow: {
        id: "media-video-preview-failed-1",
        storage_path: "user-1/generations/videos/media-video-preview-failed-1.mp4",
        file_type: "video",
      },
    });
    supabase.mediaUpdateEqUserMock.mockResolvedValueOnce({
      error: { message: "preview update failed" },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(Buffer.from("video-buffer"), {
        status: 200,
        headers: { "content-type": "video/mp4" },
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
        generationId: "gen-video-preview-failed-1",
        index: 0,
        previewStoragePathHint:
          "user-1/variants/videos/media-video-preview-failed-1/preview_loop_360p.mp4",
        fullStoragePathHint: "user-1/generations/videos/media-video-preview-failed-1.mp4",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(supabase.mediaEventsInsertMock).toHaveBeenCalledWith({
      user_id: "user-1",
      event_type: "variant_hydration_failed",
      entity_type: "media_file",
      entity_id: "media-video-preview-failed-1",
      metadata: expect.objectContaining({
        variant_kind: "preview",
        source: "ai_studio",
        generation_id: "gen-video-preview-failed-1",
        output_index: 0,
        message: "preview update failed",
      }),
    });
    expect(supabase.uploadMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("generates a durable poster from the video buffer when no poster hint is provided", async () => {
    detectVideoMimeTypeMock.mockImplementation((buffer: Buffer) =>
      buffer.toString() === "video-buffer" ? "video/mp4" : null
    );
    upsertVideoPosterVariantFromBufferMock.mockResolvedValueOnce(
      "user-1/variants/videos/media-video-buffer-poster-1/poster_720.jpg"
    );

    const supabase = createSupabaseAdmin({
      generationOutputRows: [
        {
          id: "gen-output-buffer-poster-1",
          output_index: 0,
          result_url: "https://trusted.example.com/output.mp4",
          media_file_id: null,
        },
      ],
      insertRow: {
        id: "media-video-buffer-poster-1",
        storage_path: "user-1/generations/videos/media-video-buffer-poster-1.mp4",
        file_type: "video",
      },
      signedUrls: {
        "user-1/generations/videos/media-video-buffer-poster-1.mp4":
          "https://signed.test/video-buffer.mp4",
        "user-1/variants/videos/media-video-buffer-poster-1/poster_720.jpg":
          "https://signed.test/video-buffer-poster.jpg",
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

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/output.mp4",
        source: "ai_studio",
        mode: "video",
        generationId: "gen-video-buffer-poster-1",
        index: 0,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(upsertVideoPosterVariantFromBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        supabaseAdmin: supabase.admin,
        userId: "user-1",
        mediaFileId: "media-video-buffer-poster-1",
        videoBuffer: Buffer.from("video-buffer"),
        videoMimeType: "video/mp4",
        metadata: expect.objectContaining({
          generated_by: "media-copy-from-url",
          poster_source: "video_buffer",
          source: "ai_studio",
          generation_id: "gen-video-buffer-poster-1",
          output_index: 0,
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileId: "media-video-buffer-poster-1",
        fileType: "video",
        delivery: expect.objectContaining({
          previewPosterStoragePath:
            "user-1/variants/videos/media-video-buffer-poster-1/poster_720.jpg",
          previewPosterUrl: "https://signed.test/video-buffer-poster.jpg",
        }),
      })
    );
  });

  it("generates a durable preview loop from the video buffer when no preview hint is provided", async () => {
    detectVideoMimeTypeMock.mockImplementation((buffer: Buffer) =>
      buffer.toString() === "video-buffer" ? "video/mp4" : null
    );
    upsertVideoPreviewVariantFromBufferMock.mockResolvedValueOnce(
      "user-1/variants/videos/media-video-buffer-preview-1/preview_loop_360p.mp4"
    );

    const supabase = createSupabaseAdmin({
      generationOutputRows: [
        {
          id: "gen-output-buffer-preview-1",
          output_index: 0,
          result_url: "https://trusted.example.com/output.mp4",
          media_file_id: null,
        },
      ],
      insertRow: {
        id: "media-video-buffer-preview-1",
        storage_path: "user-1/generations/videos/media-video-buffer-preview-1.mp4",
        file_type: "video",
      },
      signedUrls: {
        "user-1/generations/videos/media-video-buffer-preview-1.mp4":
          "https://signed.test/video-buffer-preview-full.mp4",
        "user-1/variants/videos/media-video-buffer-preview-1/preview_loop_360p.mp4":
          "https://signed.test/video-buffer-preview-loop.mp4",
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

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/output.mp4",
        source: "ai_studio",
        mode: "video",
        generationId: "gen-video-buffer-preview-1",
        index: 0,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(upsertVideoPreviewVariantFromBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        supabaseAdmin: supabase.admin,
        userId: "user-1",
        mediaFileId: "media-video-buffer-preview-1",
        videoBuffer: Buffer.from("video-buffer"),
        videoMimeType: "video/mp4",
        metadata: expect.objectContaining({
          generated_by: "media-copy-from-url",
          preview_source: "video_buffer",
          source: "ai_studio",
          generation_id: "gen-video-buffer-preview-1",
          output_index: 0,
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileId: "media-video-buffer-preview-1",
        fileType: "video",
        delivery: expect.objectContaining({
          previewStoragePath:
            "user-1/variants/videos/media-video-buffer-preview-1/preview_loop_360p.mp4",
          previewUrl: "https://signed.test/video-buffer-preview-loop.mp4",
          fullStoragePath: "user-1/generations/videos/media-video-buffer-preview-1.mp4",
          fullUrl: "https://signed.test/video-buffer-preview-full.mp4",
        }),
      })
    );
  });

  it("ignores foreign preview variant paths returned by the inserted media row before signing delivery URLs", async () => {
    detectVideoMimeTypeMock.mockImplementation((buffer: Buffer) =>
      buffer.toString() === "video-buffer" ? "video/mp4" : null
    );

    const supabase = createSupabaseAdmin({
      generationOutputRows: [
        {
          id: "gen-output-foreign-preview-1",
          output_index: 0,
          result_url: "https://trusted.example.com/output.mp4",
          media_file_id: null,
        },
      ],
      insertRow: {
        id: "media-video-foreign-preview-1",
        storage_path: "user-1/generations/videos/media-video-foreign-preview-1.mp4",
        file_type: "video",
        preview_variant_path: "user-2/variants/videos/foreign-preview.mp4",
      },
      signedUrls: {
        "user-1/generations/videos/media-video-foreign-preview-1.mp4":
          "https://signed.test/video-foreign-preview-full.mp4",
        "user-2/variants/videos/foreign-preview.mp4":
          "https://signed.test/video-foreign-preview-loop.mp4",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(Buffer.from("video-buffer"), {
          status: 200,
          headers: { "content-type": "video/mp4" },
        })
      )
    );

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/output.mp4",
        source: "ai_studio",
        mode: "video",
        generationId: "gen-video-foreign-preview-1",
        index: 0,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(supabase.createSignedUrlMock).not.toHaveBeenCalledWith(
      "user-2/variants/videos/foreign-preview.mp4",
      expect.anything()
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileId: "media-video-foreign-preview-1",
        fileType: "video",
        delivery: expect.objectContaining({
          previewStoragePath: "user-1/generations/videos/media-video-foreign-preview-1.mp4",
          previewUrl: "https://signed.test/video-foreign-preview-full.mp4",
          fullStoragePath: "user-1/generations/videos/media-video-foreign-preview-1.mp4",
          fullUrl: "https://signed.test/video-foreign-preview-full.mp4",
        }),
      })
    );
  });

  it("skips oversized inline poster payloads without failing the main video save", async () => {
    detectVideoMimeTypeMock.mockImplementation((buffer: Buffer) =>
      buffer.toString() === "video-buffer" ? "video/mp4" : null
    );

    const supabase = createSupabaseAdmin({
      generationOutputRows: [
        {
          id: "gen-output-oversized-poster-1",
          output_index: 0,
          result_url: "https://trusted.example.com/output.mp4",
          media_file_id: null,
        },
      ],
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
        metadata: { index: 0 },
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
        previewPosterStoragePath: null,
        previewUrl: "https://signed.test/existing.png",
        fullUrl: "https://signed.test/existing.png",
        previewPosterUrl: null,
      },
    });
    expect(supabase.generationOutputUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        media_file_id: "media-existing-1",
      })
    );
    expect(supabase.generationPublicationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-1",
        owned_media_file_id: "media-existing-1",
        preview_storage_path: "user-1/generations/images/existing.png",
      }),
      expect.objectContaining({
        onConflict: "generation_output_id",
      })
    );
    expect(supabase.generationProjectionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-1",
        user_id: "user-1",
        saved_media_ids: ["media-existing-1"],
      }),
      expect.objectContaining({
        onConflict: "generation_id",
      })
    );
  });

  it("does not reuse an existing ai_studio row when its stored path falls outside the caller scope", async () => {
    const supabase = createSupabaseAdmin({
      existingRow: {
        id: "media-existing-foreign-1",
        storage_path: "user-2/generations/images/foreign.png",
        file_type: "image",
        metadata: { index: 0 },
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
      },
      canonicalOutputMediaFileId: "media-existing-foreign-1",
      generationOutputRows: [
        {
          id: "gen-output-foreign-1",
          output_index: 0,
          result_url: "https://trusted.example.com/reference.png",
          media_file_id: null,
        },
      ],
      insertRow: {
        id: "media-repaired-1",
        storage_path: "user-1/generations/images/repaired.png",
        file_type: "image",
        metadata: { index: 0 },
      },
      signedUrls: {
        "user-1/generations/images/repaired.png": "https://signed.test/repaired.png",
        "user-2/generations/images/foreign.png": "https://signed.test/foreign.png",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockImplementation(
      async () =>
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
        source: "ai_studio",
        generationId: "gen-foreign-1",
        index: 0,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(supabase.uploadMock).toHaveBeenCalledTimes(1);
    expect(supabase.createSignedUrlMock).not.toHaveBeenCalledWith(
      "user-2/generations/images/foreign.png",
      expect.anything()
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileId: "media-repaired-1",
        storagePath: expect.stringMatching(/^user-1\/generations\/images\//),
        delivery: expect.objectContaining({
          previewStoragePath: expect.stringMatching(/^user-1\/generations\/images\//),
          fullStoragePath: expect.stringMatching(/^user-1\/generations\/images\//),
          previewUrl: "https://signed.test/repaired.png",
          fullUrl: "https://signed.test/repaired.png",
        }),
      })
    );
  });

  it("repairs an existing ai_studio video row with stale file_type by hydrating missing derivatives", async () => {
    detectVideoMimeTypeMock.mockImplementation((buffer: Buffer) =>
      buffer.toString() === "video-buffer" ? "video/mp4" : null
    );
    upsertVideoPosterVariantFromBufferMock.mockResolvedValueOnce(
      "user-1/variants/videos/media-existing-video-1/poster_720.jpg"
    );
    upsertVideoPreviewVariantFromBufferMock.mockResolvedValueOnce(
      "user-1/variants/videos/media-existing-video-1/preview_loop_360p.mp4"
    );
    const supabase = createSupabaseAdmin({
      existingRow: {
        id: "media-existing-video-1",
        storage_path: "user-1/generations/videos/existing.mp4",
        file_type: "image/png",
        metadata: { index: 0 },
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
      },
      canonicalOutputMediaFileId: "media-existing-video-1",
      generationOutputRows: [
        {
          id: "gen-output-video-1",
          output_index: 0,
          result_url: "https://trusted.example.com/reference.mp4",
          media_file_id: "media-existing-video-1",
        },
      ],
      insertError: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
      signedUrls: {
        "user-1/generations/videos/existing.mp4": "https://signed.test/existing.mp4",
        "user-1/variants/videos/media-existing-video-1/poster_720.jpg":
          "https://signed.test/existing-poster.jpg",
        "user-1/variants/videos/media-existing-video-1/preview_loop_360p.mp4":
          "https://signed.test/existing-preview.mp4",
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

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/reference.mp4",
        source: "ai_studio",
        mode: "video",
        generationId: "gen-video-1",
        index: 0,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(supabase.uploadMock).toHaveBeenCalledTimes(1);
    expect(supabase.removeMock).toHaveBeenCalledTimes(1);
    expect(upsertVideoPosterVariantFromBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        supabaseAdmin: supabase.admin,
        userId: "user-1",
        mediaFileId: "media-existing-video-1",
        videoBuffer: Buffer.from("video-buffer"),
        videoMimeType: "video/mp4",
      })
    );
    expect(upsertVideoPreviewVariantFromBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        supabaseAdmin: supabase.admin,
        userId: "user-1",
        mediaFileId: "media-existing-video-1",
        videoBuffer: Buffer.from("video-buffer"),
        videoMimeType: "video/mp4",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileId: "media-existing-video-1",
        fileType: "video",
        delivery: expect.objectContaining({
          previewStoragePath: "user-1/variants/videos/media-existing-video-1/preview_loop_360p.mp4",
          previewPosterStoragePath: "user-1/variants/videos/media-existing-video-1/poster_720.jpg",
          previewUrl: "https://signed.test/existing-preview.mp4",
          previewPosterUrl: "https://signed.test/existing-poster.jpg",
          fullStoragePath: "user-1/generations/videos/existing.mp4",
          fullUrl: "https://signed.test/existing.mp4",
        }),
      })
    );
  });

  it("fails closed when a duplicate ai_studio row exists but its stored paths are outside the caller scope", async () => {
    detectImageMimeTypeMock.mockReturnValue("image/png");
    const insertError = {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    };
    const supabase = createSupabaseAdmin({
      existingRow: {
        id: "media-duplicate-foreign-1",
        storage_path: "user-2/generations/images/foreign.png",
        file_type: "image",
        metadata: { index: 0 },
        thumb_variant_path: null,
        poster_variant_path: null,
        preview_variant_path: null,
      },
      canonicalOutputMediaFileId: "media-duplicate-foreign-1",
      generationOutputRows: [
        {
          id: "gen-output-duplicate-foreign-1",
          output_index: 0,
          result_url: "https://trusted.example.com/reference.png",
          media_file_id: null,
        },
      ],
      insertError,
      signedUrls: {
        "user-2/generations/images/foreign.png": "https://signed.test/foreign.png",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockImplementation(
      async () =>
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
        source: "ai_studio",
        generationId: "gen-duplicate-foreign-1",
        index: 0,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(supabase.uploadMock).toHaveBeenCalledTimes(1);
    expect(supabase.removeMock).toHaveBeenCalledTimes(1);
    expect(supabase.createSignedUrlMock).not.toHaveBeenCalledWith(
      "user-2/generations/images/foreign.png",
      expect.anything()
    );
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: insertError,
        routeLabel: "media-copy-from-url",
        scope: "generation",
        user: { id: "user-1", email: "u@example.com" },
        metadata: expect.objectContaining({
          response_status: 500,
          failure_stage: "media_row_insert",
          source: "ai_studio",
          mode: "image",
          file_type: "image",
          generation_id_present: true,
          output_index: 0,
          trusted_url_host: "trusted.example.com",
          duplicate_insert: true,
          storage_path_created: true,
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to persist media record",
    });
  });

  it("falls back to legacy generation_output_index lookup when canonical output media linkage is absent", async () => {
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
    vi.stubGlobal("fetch", vi.fn());

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

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileId: "media-existing-legacy-1",
      })
    );
    expect(supabase.mediaMaybeSingleMock).toHaveBeenCalled();
  });

  it("also reuses index-only ai_studio rows created during the regression window", async () => {
    const supabase = createSupabaseAdmin({
      existingRow: {
        id: "media-existing-index-only-1",
        storage_path: "user-1/generations/images/existing-index-only.png",
        file_type: "image",
        metadata: { index: 0 },
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
        "user-1/generations/images/existing-index-only.png":
          "https://signed.test/existing-index-only.png",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    vi.stubGlobal("fetch", vi.fn());

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

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileId: "media-existing-index-only-1",
      })
    );
  });

  it("fetches, uploads, and links a trusted ai_studio image URL", async () => {
    const supabase = createSupabaseAdmin({
      generationProjectionRow: {
        preview_url: "https://trusted.example.com/generated-reference.png",
        result_urls: ["https://trusted.example.com/generated-reference.png"],
        preview_storage_path: null,
        full_storage_path: null,
      },
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
    const fetchMock = vi.fn().mockImplementation(
      async () =>
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
    expect(supabase.generationPublicationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-22",
        owned_media_file_id: "media-generated-1",
      }),
      expect.objectContaining({
        onConflict: "generation_output_id",
      })
    );
    expect(supabase.generationProjectionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_id: "gen-22",
        user_id: "user-1",
        saved_media_ids: ["media-generated-1"],
      }),
      expect.objectContaining({
        onConflict: "generation_id",
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
    const fetchMock = vi.fn().mockImplementation(
      async () =>
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
        previewStoragePath: "user-1/uploads/images/media-new-1.png",
        fullStoragePath: "user-1/uploads/images/media-new-1.png",
        previewPosterStoragePath: null,
        previewUrl: "https://signed.test/media-new-1.png",
        fullUrl: "https://signed.test/media-new-1.png",
        previewPosterUrl: null,
      },
    });
  });

  it("logs storage upload failures before returning the route-owned 500", async () => {
    const uploadError = { message: "storage upload unavailable" };
    const supabase = createSupabaseAdmin({
      uploadError,
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockImplementation(
      async () =>
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

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: uploadError,
        routeLabel: "media-copy-from-url",
        scope: "generation",
        user: { id: "user-1", email: "u@example.com" },
        metadata: expect.objectContaining({
          response_status: 500,
          failure_stage: "storage_upload",
          source: "upload",
          mode: "image",
          file_type: "image",
          generation_id_present: false,
          output_index: 0,
          trusted_url_host: "trusted.example.com",
          storage_path_created: false,
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Upload failed",
    });
  });

  it("logs media row insert failures before returning the route-owned 500", async () => {
    const insertError = { code: "PGRST204", message: "insert failed" };
    const supabase = createSupabaseAdmin({
      insertError,
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockImplementation(
      async () =>
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

    expect(supabase.uploadMock).toHaveBeenCalledTimes(1);
    expect(supabase.removeMock).toHaveBeenCalledTimes(1);
    expect(supabase.removeMock).toHaveBeenCalledWith([
      expect.stringMatching(/^user-1\/uploads\/images\//),
    ]);
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: insertError,
        routeLabel: "media-copy-from-url",
        scope: "generation",
        user: { id: "user-1", email: "u@example.com" },
        metadata: expect.objectContaining({
          response_status: 500,
          failure_stage: "media_row_insert",
          source: "upload",
          mode: "image",
          file_type: "image",
          generation_id_present: false,
          output_index: 0,
          trusted_url_host: "trusted.example.com",
          duplicate_insert: false,
          storage_path_created: true,
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to persist media record",
    });
  });

  it("admits an over-cap trusted still image before storage", async () => {
    const originalByteLength = 26 * 1024 * 1024;
    const originalBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const admittedBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46]);
    admitImageBufferForProductUseMock.mockResolvedValueOnce({
      status: "admitted",
      buffer: admittedBuffer,
      dimensions: { width: 1024, height: 768 },
      mimeType: "image/webp",
      metadata: {
        version: 1,
        status: "admitted",
        policy: "shortpulse_image_admission_25mb",
        max_bytes: 25 * 1024 * 1024,
        target_bytes: 23 * 1024 * 1024,
        original_bytes: originalByteLength,
        admitted_bytes: admittedBuffer.byteLength,
        original_mime_type: "image/png",
        admitted_mime_type: "image/webp",
        original_width: 2048,
        original_height: 1536,
        admitted_width: 1024,
        admitted_height: 768,
        strategy: "server_sharp",
        original_preserved: false,
        original_storage_path: null,
        admitted_storage_path: null,
        supabase_transform_used: false,
      },
    });
    const supabase = createSupabaseAdmin({
      insertRow: {
        id: "media-admitted-1",
        storage_path: "user-1/uploads/images/media-admitted-1.webp",
        file_type: "image",
        metadata: { prompt: "large reference image" },
      },
      signedUrls: {
        "user-1/uploads/images/media-admitted-1.webp": "https://signed.test/media-admitted-1.webp",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(originalBuffer, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Content-Length": String(originalByteLength),
          },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      body: {
        url: "https://trusted.example.com/large-reference.png",
        promptText: "large reference image",
        mode: "image",
        source: "upload",
        index: 0,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(admitImageBufferForProductUseMock).toHaveBeenCalledWith({
      buffer: originalBuffer,
      mimeType: "image/png",
    });
    expect(supabase.uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/uploads\/images\/.+\.webp$/),
      admittedBuffer,
      expect.objectContaining({
        contentType: "image/webp",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaFileId: "media-admitted-1",
        fileType: "image",
        fileSize: admittedBuffer.byteLength,
      })
    );
  });

  it("rejects oversized responses before buffering the full body", async () => {
    const supabase = createSupabaseAdmin();
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "Content-Type": "image/png", "Content-Length": String(130 * 1024 * 1024) },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      socket: { remoteAddress: "127.0.0.1" },
      body: { url: "https://trusted.example.com/too-large.png", mode: "image" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fetched media exceeds size limit.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("rejects trusted videos over the standard storage upload cap before storage upload", async () => {
    const supabase = createSupabaseAdmin({
      generationOutputRows: [
        {
          id: "gen-output-too-large-1",
          output_index: 0,
          result_url: "https://trusted.example.com/too-large.mp4",
          media_file_id: null,
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), {
        status: 200,
        headers: { "Content-Type": "video/mp4", "Content-Length": String(60 * 1024 * 1024) },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      socket: { remoteAddress: "127.0.0.1" },
      body: {
        url: "https://trusted.example.com/too-large.mp4",
        mode: "video",
        source: "ai_studio",
        generationId: "generation-1",
        fileTypeHint: "video",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(supabase.uploadMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fetched media exceeds size limit.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("rejects image-hinted provider URLs that resolve to over-cap video before storage upload", async () => {
    detectVideoMimeTypeMock.mockReturnValueOnce("video/mp4");
    const supabase = createSupabaseAdmin({
      generationOutputRows: [
        {
          id: "gen-output-mislabeled-too-large-1",
          output_index: 0,
          result_url: "https://trusted.example.com/mislabeled-output",
          media_file_id: null,
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(supabase.admin);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.alloc(50 * 1024 * 1024 + 1), {
        status: 200,
        headers: { "Content-Type": "video/mp4" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      headers: { host: "app.shortpulse.test", "x-forwarded-proto": "https" },
      socket: { remoteAddress: "127.0.0.1" },
      body: {
        url: "https://trusted.example.com/mislabeled-output",
        mode: "image",
        source: "ai_studio",
        generationId: "generation-1",
        fileTypeHint: "image",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(supabase.uploadMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fetched media exceeds size limit.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated media copy requests for the same authenticated user", async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
          status: 200,
          headers: { "Content-Type": "image/png", "Content-Length": "4" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    for (let index = 0; index < 8; index += 1) {
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
      const req = {
        method: "POST",
        headers: {
          host: "app.shortpulse.test",
          "x-forwarded-proto": "https",
        },
        socket: { remoteAddress: "127.0.0.1" },
        body: {
          url: `https://trusted.example.com/reference-${index}.png`,
          promptText: "reference image",
          mode: "image",
          source: "upload",
          index: 0,
        },
      };
      const res = createMockResponse();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
    }

    const blockedReq = {
      method: "POST",
      headers: {
        host: "app.shortpulse.test",
        "x-forwarded-proto": "https",
      },
      socket: { remoteAddress: "127.0.0.1" },
      body: {
        url: "https://trusted.example.com/reference-blocked.png",
        promptText: "reference image",
        mode: "image",
        source: "upload",
        index: 0,
      },
    };
    const blockedRes = createMockResponse();

    await handler(blockedReq as never, blockedRes as never);

    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(blockedRes.json).toHaveBeenCalledWith({
      error: "Too many requests",
      retryAfterSeconds: expect.any(Number),
    });
  });
});
