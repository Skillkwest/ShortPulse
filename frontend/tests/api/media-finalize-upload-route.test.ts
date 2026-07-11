// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/finalize-upload";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const assertPaidMediaLibraryAccessMock = vi.fn();
const finalizePreparedMediaUploadForUserMock = vi.fn();

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

vi.mock("../../lib/server/mediaUploadService", async () => {
  const actual = await vi.importActual<typeof import("../../lib/server/mediaUploadService")>(
    "../../lib/server/mediaUploadService"
  );
  return {
    ...actual,
    finalizePreparedMediaUploadForUser: (...args: unknown[]) =>
      finalizePreparedMediaUploadForUserMock(...args),
  };
});

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/media/finalize-upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    assertPaidMediaLibraryAccessMock.mockResolvedValue(undefined);
    finalizePreparedMediaUploadForUserMock.mockResolvedValue({
      id: "media-1",
      filename: "image.webp",
      storage_path: "user-1/images/image.webp",
      preview_storage_path: "user-1/images/image.webp",
      file_type: "image",
      file_size: 1024,
      source: "upload",
      created_at: "2026-05-30T00:00:00.000Z",
      signedUrl: "https://signed.example/image.webp",
    });
  });

  it("finalizes a staged media upload", async () => {
    const req = {
      method: "POST",
      body: {
        intentId: "intent-1",
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
        sourceStoragePath: "user-1/upload-staging/uploaded_images/image.webp",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(finalizePreparedMediaUploadForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      intentId: "intent-1",
      destinationTab: "uploaded_images",
      storagePath: "user-1/upload-staging/uploaded_images/image.webp",
      filename: "image.webp",
      declaredMimeType: "image/webp",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      file: expect.objectContaining({
        id: "media-1",
        filename: "image.webp",
      }),
    });
  });

  it("rejects invalid requests before finalization", async () => {
    const req = {
      method: "POST",
      body: {
        intentId: "intent-1",
        destinationTab: "uploaded_images",
        sourceMimeType: "",
        sourceName: "image.webp",
        sourceStoragePath: "user-1/upload-staging/uploaded_images/image.webp",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(finalizePreparedMediaUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Upload file mime type is required.",
    });
  });

  it("rejects finalization when the upload intent is missing", async () => {
    const req = {
      method: "POST",
      body: {
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
        sourceStoragePath: "user-1/media_library/intent-1/object",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(finalizePreparedMediaUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Upload intent is required.",
    });
  });

  it("logs auth verifier failures before rate limiting or upload finalization", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        intentId: "intent-1",
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
        sourceStoragePath: "user-1/upload-staging/uploaded_images/image.webp",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "media-finalize-upload.auth",
        scope: "app",
      })
    );
    expect(finalizePreparedMediaUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to finalize media upload",
    });
  });

  it("rejects upload finalization before media rows are created when media consent is missing", async () => {
    const { MediaUploadServiceError } = await import("../../lib/server/mediaUploadService");
    finalizePreparedMediaUploadForUserMock.mockRejectedValueOnce(
      new MediaUploadServiceError(
        403,
        "Media agreement acceptance is required.",
        "Accept the current media agreement before uploading or staging media."
      )
    );
    const req = {
      method: "POST",
      body: {
        intentId: "intent-1",
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
        sourceStoragePath: "user-1/upload-staging/uploaded_images/image.webp",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(finalizePreparedMediaUploadForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      intentId: "intent-1",
      destinationTab: "uploaded_images",
      storagePath: "user-1/upload-staging/uploaded_images/image.webp",
      filename: "image.webp",
      declaredMimeType: "image/webp",
    });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Media agreement acceptance is required.",
      details: "Accept the current media agreement before uploading or staging media.",
    });
  });

  it("rejects upload finalization before validation when paid media access is missing", async () => {
    const { MediaLibraryPaidAccessError } =
      await import("../../lib/server/api/mediaLibraryPaidAccess");
    assertPaidMediaLibraryAccessMock.mockRejectedValueOnce(new MediaLibraryPaidAccessError());
    const req = {
      method: "POST",
      body: {
        intentId: "intent-1",
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
        sourceStoragePath: "user-1/upload-staging/uploaded_images/image.webp",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(assertPaidMediaLibraryAccessMock).toHaveBeenCalledWith("user-1");
    expect(finalizePreparedMediaUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      error: "Choose a plan to add media to your Reference Grid and Media Library.",
    });
  });

  it("returns a sanitized 500 when finalization fails unexpectedly", async () => {
    finalizePreparedMediaUploadForUserMock.mockRejectedValueOnce(
      new Error("storage download exploded")
    );
    const req = {
      method: "POST",
      body: {
        intentId: "intent-1",
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
        sourceStoragePath: "user-1/upload-staging/uploaded_images/image.webp",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to finalize media upload",
    });
  });

  it("logs structured finalize diagnostics for upload service 500s", async () => {
    const { MediaUploadServiceError } = await import("../../lib/server/mediaUploadService");
    const serviceError = new MediaUploadServiceError(
      500,
      "Upload failed",
      "storage move unavailable",
      {
        media_upload_stage: "prepared_upload_move",
        media_upload_operation: "storage_move",
        media_upload_destination_tab: "uploaded_videos",
        media_upload_file_type: "video",
      }
    );
    finalizePreparedMediaUploadForUserMock.mockRejectedValueOnce(serviceError);
    const req = {
      method: "POST",
      body: {
        intentId: "intent-1",
        destinationTab: "uploaded_videos",
        sourceMimeType: "video/mp4",
        sourceName: "clip.mp4",
        sourceStoragePath: "user-1/upload-staging/uploaded_videos/clip.mp4",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: serviceError,
        routeLabel: "media-finalize-upload",
        metadata: expect.objectContaining({
          media_upload_error_status: 500,
          media_upload_error_message: "Upload failed",
          media_upload_error_details: "storage move unavailable",
          media_upload_stage: "prepared_upload_move",
          media_upload_operation: "storage_move",
          media_upload_destination_tab: "uploaded_videos",
          media_upload_file_type: "video",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to finalize media upload",
    });
  });

  it("rate limits repeated upload finalization requests for the same authenticated user", async () => {
    const buildReq = () => ({
      method: "POST",
      body: {
        intentId: "intent-1",
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
        sourceStoragePath: "user-1/upload-staging/uploaded_images/image.webp",
      },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = createMockResponse();
      await handler(buildReq() as never, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
    }

    const res = createMockResponse();
    await handler(buildReq() as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many requests",
      retryAfterSeconds: expect.any(Number),
    });
  });
});
