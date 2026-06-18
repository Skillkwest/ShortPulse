import fs from "fs";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/upload";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const buildWebmTrackSignature = (trackType: number): Buffer =>
  Buffer.from([
    0x1a,
    0x45,
    0xdf,
    0xa3,
    0x87,
    0x42,
    0x82,
    0x84,
    0x77,
    0x65,
    0x62,
    0x6d,
    0x18,
    0x53,
    0x80,
    0x67,
    0x8a,
    0x16,
    0x54,
    0xae,
    0x6b,
    0x85,
    0xae,
    0x83,
    0x83,
    0x81,
    trackType,
  ]);

const buildMp4Signature = (): Buffer =>
  Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x31,
  ]);

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const upsertVideoPosterVariantFromBufferMock = vi.fn();
const upsertVideoPreviewVariantFromBufferMock = vi.fn();

let mockFields: Record<string, unknown> = {};
let mockParseError: Error | null = null;
let mockFile = {
  filepath: "/tmp/mock-media-upload",
  mimetype: "image/png",
  size: 16,
  originalFilename: "asset.png",
};

const formidableFactoryMock = vi.fn(() => ({
  parse: (
    _req: unknown,
    callback: (err: unknown, fields: unknown, files: Record<string, unknown>) => void
  ) => {
    if (mockParseError) {
      callback(mockParseError, {}, {});
      return;
    }
    callback(null, mockFields, { file: mockFile });
  },
}));

vi.mock("formidable", () => ({
  default: () => formidableFactoryMock(),
}));

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/videoPosterVariant", () => ({
  upsertVideoPosterVariantFromBuffer: (...args: unknown[]) =>
    upsertVideoPosterVariantFromBufferMock(...args),
  upsertVideoPreviewVariantFromBuffer: (...args: unknown[]) =>
    upsertVideoPreviewVariantFromBufferMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const buildOversizedPngBuffer = async (): Promise<Buffer> =>
  await sharp(Buffer.alloc(3200 * 2800 * 3, 127), {
    raw: { width: 3200, height: 2800, channels: 3 },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();

const setupSupabaseUpload = (options?: {
  insertedRow?: Record<string, unknown>;
  uploadError?: { message: string } | null;
  insertError?: { message: string; code?: string } | null;
  signedUrl?: string;
}) => {
  const uploadMock = vi.fn(async () => ({ error: options?.uploadError ?? null }));
  const removeMock = vi.fn(async () => ({ data: null, error: null }));
  const createSignedUrlMock = vi.fn(async () => ({
    data: {
      signedUrl: options?.signedUrl ?? "https://signed.example/media-upload",
    },
    error: null,
  }));

  const singleMock = vi.fn(async () => ({
    data: options?.insertError
      ? null
      : {
          id: "media-upload-1",
          user_id: "user-1",
          filename: "asset.png",
          storage_path: "user-1/private/images/media-upload-1-asset.png",
          file_type: "image",
          file_size: 16,
          source: "private_upload",
          created_at: "2026-02-27T00:00:00.000Z",
          metadata: {},
          thumb_variant_path: null,
          poster_variant_path: null,
          preview_variant_path: null,
          ...(options?.insertedRow ?? {}),
        },
    error: options?.insertError ?? null,
  }));

  const selectMock = vi.fn(() => ({ single: singleMock }));
  const insertMock = vi.fn(() => ({ select: selectMock }));
  const fromMock = vi.fn((table: string) => {
    if (table === "media_files") {
      return {
        insert: insertMock,
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  getSupabaseAdminMock.mockReturnValue({
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        remove: removeMock,
        createSignedUrl: createSignedUrlMock,
      })),
    },
    from: fromMock,
  });

  return {
    uploadMock,
    removeMock,
    createSignedUrlMock,
    insertMock,
  };
};

describe("POST /api/media/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    vi.unstubAllEnvs();
    upsertVideoPosterVariantFromBufferMock.mockResolvedValue(null);
    upsertVideoPreviewVariantFromBufferMock.mockResolvedValue(null);
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    mockFields = { destinationTab: "private" };
    mockParseError = null;
    mockFile = {
      filepath: "/tmp/mock-media-upload",
      mimetype: "image/png",
      size: 16,
      originalFilename: "asset.png",
    };
    vi.spyOn(fs, "unlinkSync").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("logs auth verifier failures before rate limiting or multipart parsing", async () => {
    const authError = new Error("auth verifier exploded");
    requireApiUserMock.mockRejectedValueOnce(authError);
    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: authError,
        routeLabel: "media-upload.auth",
        scope: "app",
      })
    );
    expect(formidableFactoryMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Upload failed" });
  });

  it("uploads and persists media for a private destination", async () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    const { uploadMock, insertMock } = setupSupabaseUpload();

    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        source: "private_upload",
        file_type: "image",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      file: expect.objectContaining({
        id: "media-upload-1",
        storage_path: expect.stringMatching(/^user-1\/private\/images\//),
        preview_storage_path: expect.stringMatching(/^user-1\//),
        signedUrl: "https://signed.example/media-upload",
      }),
    });
  });

  it("accepts audio-only WebM uploads even when the browser declares video/webm", async () => {
    mockFields = { destinationTab: "uploaded_videos" };
    mockFile = {
      filepath: "/tmp/mock-media-upload-audio-webm",
      mimetype: "video/webm",
      size: 27,
      originalFilename: "audio-track.webm",
    };
    vi.spyOn(fs, "readFileSync").mockReturnValue(buildWebmTrackSignature(0x02));
    const { uploadMock, insertMock } = setupSupabaseUpload({
      insertedRow: {
        filename: "audio-track.webm",
        storage_path: "user-1/audio/media-upload-1-audio-track.webm",
        file_type: "audio",
        source: "upload",
      },
    });

    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/audio\//),
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "audio/webm",
      })
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "audio-track.webm",
        file_type: "audio",
        source: "upload",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      file: expect.objectContaining({
        filename: "audio-track.webm",
        file_type: "audio",
        storage_path: expect.stringMatching(/^user-1\/audio\//),
      }),
    });
  });

  it("hydrates a preview-loop variant for uploaded videos before signing the preview response", async () => {
    mockFields = { destinationTab: "uploaded_videos" };
    mockFile = {
      filepath: "/tmp/mock-media-upload-video",
      mimetype: "video/mp4",
      size: 24,
      originalFilename: "clip.mp4",
    };
    vi.spyOn(fs, "readFileSync").mockReturnValue(buildMp4Signature());
    upsertVideoPreviewVariantFromBufferMock.mockResolvedValueOnce(
      "user-1/variants/videos/media-upload-video-1/preview_loop_360p.mp4"
    );
    upsertVideoPosterVariantFromBufferMock.mockResolvedValueOnce(
      "user-1/variants/videos/media-upload-video-1/poster_720.jpg"
    );
    const { createSignedUrlMock, insertMock } = setupSupabaseUpload({
      insertedRow: {
        id: "media-upload-video-1",
        filename: "clip.mp4",
        storage_path: "user-1/videos/media-upload-video-1-clip.mp4",
        file_type: "video",
        file_size: 24,
        source: "upload",
      },
      signedUrl: "https://signed.example/video-preview-loop",
    });

    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "clip.mp4",
        file_type: "video",
        source: "upload",
      })
    );
    expect(upsertVideoPreviewVariantFromBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        mediaFileId: "media-upload-video-1",
        filename: "clip.mp4",
        metadata: expect.objectContaining({
          generated_by: "media_upload_service",
          upload_source: "upload",
        }),
      })
    );
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      "user-1/variants/videos/media-upload-video-1/preview_loop_360p.mp4",
      3600
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      file: expect.objectContaining({
        id: "media-upload-video-1",
        file_type: "video",
        storage_path: "user-1/videos/media-upload-video-1-clip.mp4",
        preview_storage_path: "user-1/variants/videos/media-upload-video-1/preview_loop_360p.mp4",
        signedUrl: "https://signed.example/video-preview-loop",
      }),
    });
  });

  it("normalizes oversized image uploads before the canonical image size cap is enforced", async () => {
    const oversizedPng = await buildOversizedPngBuffer();
    mockFile = {
      filepath: "/tmp/mock-media-upload-oversized-image",
      mimetype: "image/png",
      size: oversizedPng.length,
      originalFilename: "oversized-reference.png",
    };
    vi.spyOn(fs, "readFileSync").mockReturnValue(oversizedPng);
    const { uploadMock, insertMock } = setupSupabaseUpload();

    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const uploadCalls = uploadMock.mock.calls as unknown as Array<
      [string, Buffer, { contentType: string }]
    >;
    const uploadCall = uploadCalls[0];
    expect(uploadCall).toBeDefined();
    if (!uploadCall) {
      throw new Error("Expected the upload service to receive a normalized image buffer.");
    }
    const [, uploadedBuffer, uploadOptions] = uploadCall;
    expect(uploadedBuffer.length).toBeLessThan(oversizedPng.length);
    expect(uploadedBuffer.length).toBeLessThanOrEqual(25 * 1024 * 1024);
    expect(uploadOptions.contentType).toMatch(/^image\/(avif|webp|jpeg)$/);

    const insertCalls = insertMock.mock.calls as unknown as Array<[Record<string, unknown>]>;
    const insertCall = insertCalls[0];
    expect(insertCall).toBeDefined();
    if (!insertCall) {
      throw new Error("Expected the media row insert payload to be recorded.");
    }
    const [insertPayload] = insertCall;
    expect(insertPayload.file_size).toBe(uploadedBuffer.length);
    expect(insertPayload.metadata).toEqual(
      expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
        aspect_ratio: expect.any(Number),
        image_admission: expect.objectContaining({
          status: "admitted",
          strategy: expect.any(String),
          original_preserved: false,
          original_bytes: oversizedPng.length,
          admitted_bytes: uploadedBuffer.length,
          original_mime_type: "image/png",
          admitted_mime_type: uploadOptions.contentType,
          supabase_transform_used: false,
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects mismatched content type vs file signature", async () => {
    // JPEG signature while multipart declares image/png
    vi.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from([0xff, 0xd8, 0xff, 0xdb]));
    setupSupabaseUpload();

    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid file type",
      details:
        "Content type does not match file content (declared: image/png, detected: image/jpeg).",
    });
  });

  it("returns 503 when media upload API is disabled", async () => {
    vi.stubEnv("SHORTPULSE_MEDIA_UPLOAD_API_ENABLED", "false");
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    setupSupabaseUpload();

    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Media upload API is disabled",
      details: "Enable SHORTPULSE_MEDIA_UPLOAD_API_ENABLED to use this route.",
    });
  });

  it("returns 409 and cleans up uploaded storage when account storage is full", async () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    const { removeMock } = setupSupabaseUpload({
      insertError: {
        code: "P0001",
        message:
          "Media storage limit exceeded (used_bytes=1073741824 incoming_bytes=16 limit_bytes=1073741824)",
      },
    });

    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "Media storage limit exceeded",
      details:
        "Delete media, upgrade your plan, or add recurring storage before uploading more files.",
    });
  });

  it("logs unexpected multipart parser failures and returns 500", async () => {
    mockParseError = new Error("Multipart parser exploded");

    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Upload failed",
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "media-upload",
        error: expect.objectContaining({ message: "Multipart parser exploded" }),
      })
    );
  });

  it("rate limits repeated uploads for the same authenticated user", async () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    setupSupabaseUpload();

    for (let index = 0; index < 12; index += 1) {
      const req = {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=x",
        },
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = createMockResponse();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
    }

    const blockedReq = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
      socket: { remoteAddress: "127.0.0.1" },
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
