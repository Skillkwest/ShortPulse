// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/prepare-upload";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const assertPaidMediaLibraryAccessMock = vi.fn();
const prepareMediaUploadForUserMock = vi.fn();

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
    prepareMediaUploadForUser: (...args: unknown[]) => prepareMediaUploadForUserMock(...args),
  };
});

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/media/prepare-upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    assertPaidMediaLibraryAccessMock.mockResolvedValue(undefined);
    prepareMediaUploadForUserMock.mockResolvedValue({
      intentId: "intent-1",
      bucketId: "media_upload_staging",
      path: "user-1/media_library/intent-1/object",
      token: "token-1",
      mimeType: "image/webp",
      name: "image.webp",
    });
  });

  it("returns a signed upload target for a media upload", async () => {
    const req = {
      method: "POST",
      headers: { "x-shortpulse-request-id": "request-1" },
      body: {
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(prepareMediaUploadForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      idempotencyKey: "request-1",
      destinationTab: "uploaded_images",
      filename: "image.webp",
      declaredMimeType: "image/webp",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      target: {
        intentId: "intent-1",
        bucketId: "media_upload_staging",
        storagePath: "user-1/media_library/intent-1/object",
        uploadToken: "token-1",
        mimeType: "image/webp",
        name: "image.webp",
      },
    });
  });

  it("rejects missing source fields", async () => {
    const req = {
      method: "POST",
      body: {
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(prepareMediaUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Upload file name is required.",
    });
  });

  it("logs auth verifier failures before rate limiting or upload preparation", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "media-prepare-upload.auth",
        scope: "app",
      })
    );
    expect(prepareMediaUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to prepare media upload",
    });
  });

  it("rejects upload preparation before issuing a storage target when media consent is missing", async () => {
    const { MediaUploadServiceError } = await import("../../lib/server/mediaUploadService");
    prepareMediaUploadForUserMock.mockRejectedValueOnce(
      new MediaUploadServiceError(
        403,
        "Media agreement acceptance is required.",
        "Accept the current media agreement before uploading or staging media."
      )
    );
    const req = {
      method: "POST",
      body: {
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(prepareMediaUploadForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        idempotencyKey: expect.any(String),
        destinationTab: "uploaded_images",
        filename: "image.webp",
        declaredMimeType: "image/webp",
      })
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Media agreement acceptance is required.",
      details: "Accept the current media agreement before uploading or staging media.",
    });
  });

  it("rejects upload preparation before validation when paid media access is missing", async () => {
    const { MediaLibraryPaidAccessError } =
      await import("../../lib/server/api/mediaLibraryPaidAccess");
    assertPaidMediaLibraryAccessMock.mockRejectedValueOnce(new MediaLibraryPaidAccessError());
    const req = {
      method: "POST",
      body: {
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(assertPaidMediaLibraryAccessMock).toHaveBeenCalledWith("user-1");
    expect(prepareMediaUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      error: "Choose a plan to add media to your Reference Grid and Media Library.",
    });
  });

  it("returns a sanitized 500 when preparation fails unexpectedly", async () => {
    prepareMediaUploadForUserMock.mockRejectedValueOnce(new Error("signed upload target exploded"));
    const req = {
      method: "POST",
      body: {
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to prepare media upload",
    });
  });

  it("rate limits repeated upload preparation requests for the same authenticated user", async () => {
    const buildReq = () => ({
      method: "POST",
      body: {
        destinationTab: "uploaded_images",
        sourceMimeType: "image/webp",
        sourceName: "image.webp",
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
