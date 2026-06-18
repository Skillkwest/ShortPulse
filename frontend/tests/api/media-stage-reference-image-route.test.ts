import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/stage-reference-image";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const finalizeReferenceImageUploadForUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/mediaUploadService", async () => {
  const actual = await vi.importActual<typeof import("../../lib/server/mediaUploadService")>(
    "../../lib/server/mediaUploadService"
  );
  return {
    ...actual,
    finalizeReferenceImageUploadForUser: (...args: unknown[]) =>
      finalizeReferenceImageUploadForUserMock(...args),
  };
});

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/media/stage-reference-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    finalizeReferenceImageUploadForUserMock.mockResolvedValue({
      path: "user-1/images/reference/reference.png",
      url: "https://signed.example/reference.png",
      size: 128,
      mimeType: "image/png",
      name: "reference.png",
    });
  });

  it("finalizes a staged local reference image", async () => {
    const req = {
      method: "POST",
      body: {
        sourceMimeType: "image/png",
        sourceName: "reference.png",
        sourceStoragePath: "user-1/upload-staging/images/reference/reference.png",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(finalizeReferenceImageUploadForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      storagePath: "user-1/upload-staging/images/reference/reference.png",
      filename: "reference.png",
      declaredMimeType: "image/png",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://signed.example/reference.png",
      path: "user-1/images/reference/reference.png",
      size: 128,
      mimeType: "image/png",
      name: "reference.png",
    });
  });

  it("rejects invalid requests before finalization", async () => {
    const req = {
      method: "POST",
      body: {
        sourceMimeType: "",
        sourceName: "reference.png",
        sourceStoragePath: "user-1/upload-staging/images/reference/reference.png",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(finalizeReferenceImageUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Reference image mime type is required.",
    });
  });

  it("logs auth verifier failures before rate limiting or upload finalization", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        sourceMimeType: "image/png",
        sourceName: "reference.png",
        sourceStoragePath: "user-1/upload-staging/images/reference/reference.png",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "media-stage-reference-image.auth",
        scope: "generation",
      })
    );
    expect(finalizeReferenceImageUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to stage reference image",
    });
  });

  it("returns a sanitized 500 when finalization fails unexpectedly", async () => {
    finalizeReferenceImageUploadForUserMock.mockRejectedValueOnce(
      new Error("storage download exploded")
    );
    const req = {
      method: "POST",
      body: {
        sourceMimeType: "image/png",
        sourceName: "reference.png",
        sourceStoragePath: "user-1/upload-staging/images/reference/reference.png",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to stage reference image",
    });
  });

  it("rate limits repeated reference image staging for the same authenticated user", async () => {
    const buildReq = () => ({
      method: "POST",
      body: {
        sourceMimeType: "image/png",
        sourceName: "reference.png",
        sourceStoragePath: "user-1/upload-staging/images/reference/reference.png",
      },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    });

    for (let attempt = 0; attempt < 12; attempt += 1) {
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
