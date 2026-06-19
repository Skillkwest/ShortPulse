/**
 * API tests for admin dashboard tutorial thumbnail direct uploads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import finalizeHandler from "../../pages/api/admin/dashboard/tutorial-thumbnail/finalize";
import prepareHandler from "../../pages/api/admin/dashboard/tutorial-thumbnail/prepare";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const extractVideoPosterBufferMock = vi.fn();
const extractVideoPreviewVariantBufferMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/videoPosterVariant", () => ({
  extractVideoPosterBuffer: (...args: unknown[]) => extractVideoPosterBufferMock(...args),
  extractVideoPreviewVariantBuffer: (...args: unknown[]) =>
    extractVideoPreviewVariantBufferMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const gifBytes = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
]);
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

describe("admin dashboard tutorial thumbnail upload APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    extractVideoPreviewVariantBufferMock.mockResolvedValue(Buffer.from("preview-mp4"));
    extractVideoPosterBufferMock.mockResolvedValue(Buffer.from("poster-jpeg"));
  });

  it("prepares a signed upload target for a valid thumbnail file", async () => {
    const createSignedUploadUrlMock = vi.fn(async (storagePath: string) => ({
      data: { path: storagePath, token: "upload-token" },
      error: null,
    }));
    const storageFromMock = vi.fn(() => ({ createSignedUploadUrl: createSignedUploadUrlMock }));
    getSupabaseAdminMock.mockReturnValue({ storage: { from: storageFromMock } });

    const req = {
      method: "POST",
      body: {
        sourceMimeType: "image/gif",
        sourceSize: 1234,
      },
    };
    const res = createMockResponse();

    await prepareHandler(req as never, res as never);

    expect(storageFromMock).toHaveBeenCalledWith("dashboard_tutorial_thumbnails");
    expect(createSignedUploadUrlMock).toHaveBeenCalledWith(
      expect.stringMatching(/^tutorial-thumbnails\/.+\.gif$/)
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      target: {
        storagePath: expect.stringMatching(/^tutorial-thumbnails\/.+\.gif$/),
        uploadToken: "upload-token",
        mimeType: "image/gif",
        mediaType: "image",
        maxBytes: 52428800,
      },
    });
  });

  it("fails closed when thumbnail preparation returns a different storage path", async () => {
    const createSignedUploadUrlMock = vi.fn(async () => ({
      data: { path: "tutorial-thumbnails/foreign.gif", token: "upload-token" },
      error: null,
    }));
    const storageFromMock = vi.fn(() => ({ createSignedUploadUrl: createSignedUploadUrlMock }));
    getSupabaseAdminMock.mockReturnValue({ storage: { from: storageFromMock } });

    const req = {
      method: "POST",
      body: {
        sourceMimeType: "image/gif",
        sourceSize: 1234,
      },
    };
    const res = createMockResponse();

    await prepareHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to prepare thumbnail upload.",
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "admin/dashboard/tutorial-thumbnail/prepare",
        error: expect.objectContaining({
          message: "Signed upload target path did not match requested storage path.",
        }),
      })
    );
  });

  it("rejects unsupported thumbnail file types before storage", async () => {
    const req = {
      method: "POST",
      body: {
        sourceMimeType: "application/pdf",
        sourceSize: 1234,
      },
    };
    const res = createMockResponse();

    await prepareHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unsupported thumbnail file type.",
      details: "Use GIF, PNG, JPEG, WebP, MP4, MOV, or WebM.",
    });
    expect(getSupabaseAdminMock).toHaveBeenCalledTimes(1);
  });

  it("returns an actionable storage setup error when the thumbnail bucket is missing", async () => {
    const createSignedUploadUrlMock = vi.fn(async () => ({
      data: null,
      error: { message: "Bucket not found" },
    }));
    const storageFromMock = vi.fn(() => ({ createSignedUploadUrl: createSignedUploadUrlMock }));
    getSupabaseAdminMock.mockReturnValue({ storage: { from: storageFromMock } });

    const req = {
      method: "POST",
      body: {
        sourceMimeType: "image/gif",
        sourceSize: 1234,
      },
    };
    const res = createMockResponse();

    await prepareHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Thumbnail storage is not ready.",
      details:
        "Apply sql/migrations/154_add_dashboard_tutorial_thumbnail_uploads.sql in this environment.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("finalizes an uploaded thumbnail and returns signed derivative display URLs", async () => {
    const downloadMock = vi.fn(async () => ({
      data: {
        size: gifBytes.length,
        arrayBuffer: async () => gifBytes.buffer,
      },
      error: null,
    }));
    const uploadMock = vi.fn(async () => ({ data: { path: "variant" }, error: null }));
    const createSignedUrlMock = vi.fn(async (path: string) => ({
      data: { signedUrl: `https://supabase.example.com/${path}` },
      error: null,
    }));
    const storageFromMock = vi.fn(() => ({
      download: downloadMock,
      upload: uploadMock,
      createSignedUrl: createSignedUrlMock,
    }));
    getSupabaseAdminMock.mockReturnValue({ storage: { from: storageFromMock } });

    const req = {
      method: "POST",
      body: {
        sourceStoragePath: "tutorial-thumbnails/generated.gif",
        sourceMimeType: "image/gif",
        sourceSize: gifBytes.length,
      },
    };
    const res = createMockResponse();

    await finalizeHandler(req as never, res as never);

    expect(downloadMock).toHaveBeenCalledWith("tutorial-thumbnails/generated.gif");
    expect(extractVideoPreviewVariantBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        videoBuffer: Buffer.from(gifBytes),
        videoMimeType: "image/gif",
        filename: "tutorial-thumbnails/generated.gif",
        scaleFilter:
          "scale=480:-2:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2",
        previewSeconds: null,
        crf: 27,
        fps: 24,
        profile: "main",
        preset: "veryfast",
        maxRate: "1100k",
        bufSize: "2200k",
        outputBasename: "display.mp4",
      })
    );
    expect(extractVideoPosterBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        videoBuffer: Buffer.from(gifBytes),
        videoMimeType: "image/gif",
        filename: "tutorial-thumbnails/generated.gif",
        posterFilter: "thumbnail,scale=720:-2:force_original_aspect_ratio=decrease",
        jpegQuality: 3,
      })
    );
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^tutorial-thumbnail-variants\/.+\/display\.mp4$/),
      Buffer.from("preview-mp4"),
      expect.objectContaining({
        contentType: "video/mp4",
        cacheControl: "31536000",
        upsert: false,
      })
    );
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^tutorial-thumbnail-variants\/.+\/poster\.jpg$/),
      Buffer.from("poster-jpeg"),
      expect.objectContaining({
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      })
    );
    expect(createSignedUrlMock).toHaveBeenCalledWith("tutorial-thumbnails/generated.gif", 86400);
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      expect.stringMatching(/^tutorial-thumbnail-variants\/.+\/display\.mp4$/),
      86400
    );
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      expect.stringMatching(/^tutorial-thumbnail-variants\/.+\/poster\.jpg$/),
      86400
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      thumbnail: {
        storagePath: "tutorial-thumbnails/generated.gif",
        signedUrl: "https://supabase.example.com/tutorial-thumbnails/generated.gif",
        mimeType: "image/gif",
        fileSizeBytes: gifBytes.length,
        displayStoragePath: expect.stringMatching(
          /^tutorial-thumbnail-variants\/.+\/display\.mp4$/
        ),
        displaySignedUrl: expect.stringMatching(
          /^https:\/\/supabase\.example\.com\/tutorial-thumbnail-variants\/.+\/display\.mp4$/
        ),
        displayMimeType: "video/mp4",
        displayMediaType: "video",
        displayFileSizeBytes: Buffer.byteLength("preview-mp4"),
        posterStoragePath: expect.stringMatching(/^tutorial-thumbnail-variants\/.+\/poster\.jpg$/),
        posterSignedUrl: expect.stringMatching(
          /^https:\/\/supabase\.example\.com\/tutorial-thumbnail-variants\/.+\/poster\.jpg$/
        ),
        posterMimeType: "image/jpeg",
        posterFileSizeBytes: Buffer.byteLength("poster-jpeg"),
      },
    });
  });

  it("finalizes an uploaded still image into a signed WebP display derivative", async () => {
    const downloadMock = vi.fn(async () => ({
      data: {
        size: pngBytes.length,
        arrayBuffer: async () => toArrayBuffer(pngBytes),
      },
      error: null,
    }));
    const uploadMock = vi.fn(async () => ({ data: { path: "variant" }, error: null }));
    const createSignedUrlMock = vi.fn(async (path: string) => ({
      data: { signedUrl: `https://supabase.example.com/${path}` },
      error: null,
    }));
    const storageFromMock = vi.fn(() => ({
      download: downloadMock,
      upload: uploadMock,
      createSignedUrl: createSignedUrlMock,
    }));
    getSupabaseAdminMock.mockReturnValue({ storage: { from: storageFromMock } });

    const req = {
      method: "POST",
      body: {
        sourceStoragePath: "tutorial-thumbnails/generated.png",
        sourceMimeType: "image/png",
        sourceSize: pngBytes.length,
      },
    };
    const res = createMockResponse();

    await finalizeHandler(req as never, res as never);

    expect(extractVideoPreviewVariantBufferMock).not.toHaveBeenCalled();
    expect(extractVideoPosterBufferMock).not.toHaveBeenCalled();
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^tutorial-thumbnail-variants\/.+\/display\.webp$/),
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      })
    );
    expect(createSignedUrlMock).toHaveBeenCalledWith("tutorial-thumbnails/generated.png", 86400);
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      expect.stringMatching(/^tutorial-thumbnail-variants\/.+\/display\.webp$/),
      86400
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      thumbnail: {
        storagePath: "tutorial-thumbnails/generated.png",
        signedUrl: "https://supabase.example.com/tutorial-thumbnails/generated.png",
        mimeType: "image/png",
        fileSizeBytes: pngBytes.length,
        displayStoragePath: expect.stringMatching(
          /^tutorial-thumbnail-variants\/.+\/display\.webp$/
        ),
        displaySignedUrl: expect.stringMatching(
          /^https:\/\/supabase\.example\.com\/tutorial-thumbnail-variants\/.+\/display\.webp$/
        ),
        displayMimeType: "image/webp",
        displayMediaType: "image",
        displayFileSizeBytes: expect.any(Number),
        posterStoragePath: null,
        posterSignedUrl: null,
        posterMimeType: null,
        posterFileSizeBytes: null,
      },
    });
  });
});
