/**
 * API tests for admin dashboard tutorial thumbnail direct uploads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import finalizeHandler from "../../pages/api/admin/dashboard/tutorial-thumbnail/finalize";
import prepareHandler from "../../pages/api/admin/dashboard/tutorial-thumbnail/prepare";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const gifBytes = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
]);

describe("admin dashboard tutorial thumbnail upload APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("prepares a signed upload target for a valid thumbnail file", async () => {
    const createSignedUploadUrlMock = vi.fn(async () => ({
      data: { path: "tutorial-thumbnails/generated.gif", token: "upload-token" },
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
        storagePath: "tutorial-thumbnails/generated.gif",
        uploadToken: "upload-token",
        mimeType: "image/gif",
        mediaType: "image",
        maxBytes: 52428800,
      },
    });
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

  it("finalizes an uploaded thumbnail and returns a signed original URL", async () => {
    const downloadMock = vi.fn(async () => ({
      data: {
        size: gifBytes.length,
        arrayBuffer: async () => gifBytes.buffer,
      },
      error: null,
    }));
    const createSignedUrlMock = vi.fn(async () => ({
      data: { signedUrl: "https://supabase.example.com/signed.gif" },
      error: null,
    }));
    const storageFromMock = vi.fn(() => ({
      download: downloadMock,
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
    expect(createSignedUrlMock).toHaveBeenCalledWith("tutorial-thumbnails/generated.gif", 86400);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      thumbnail: {
        storagePath: "tutorial-thumbnails/generated.gif",
        signedUrl: "https://supabase.example.com/signed.gif",
        mimeType: "image/gif",
        mediaType: "image",
        fileSizeBytes: gifBytes.length,
      },
    });
  });
});
