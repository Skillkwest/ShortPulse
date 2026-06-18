import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/prepare-reference-image-upload";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const prepareReferenceImageUploadForUserMock = vi.fn();

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
    prepareReferenceImageUploadForUser: (...args: unknown[]) =>
      prepareReferenceImageUploadForUserMock(...args),
  };
});

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/media/prepare-reference-image-upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    prepareReferenceImageUploadForUserMock.mockResolvedValue({
      path: "user-1/upload-staging/images/reference/reference.png",
      token: "token-1",
      mimeType: "image/png",
      name: "reference.png",
    });
  });

  it("returns a signed upload target for a local reference image", async () => {
    const req = {
      method: "POST",
      body: {
        sourceMimeType: "image/png",
        sourceName: "reference.png",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(prepareReferenceImageUploadForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      filename: "reference.png",
      declaredMimeType: "image/png",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      target: {
        storagePath: "user-1/upload-staging/images/reference/reference.png",
        uploadToken: "token-1",
        mimeType: "image/png",
        name: "reference.png",
      },
    });
  });

  it("rejects missing source fields", async () => {
    const req = {
      method: "POST",
      body: {
        sourceMimeType: "image/png",
        sourceName: "",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(prepareReferenceImageUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Reference image name is required.",
    });
  });

  it("logs auth verifier failures before rate limiting or upload preparation", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        sourceMimeType: "image/png",
        sourceName: "reference.png",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "media-prepare-reference-image-upload.auth",
        scope: "generation",
      })
    );
    expect(prepareReferenceImageUploadForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to prepare reference image upload",
    });
  });

  it("returns a sanitized 500 when preparation fails unexpectedly", async () => {
    prepareReferenceImageUploadForUserMock.mockRejectedValueOnce(
      new Error("signed upload target exploded")
    );
    const req = {
      method: "POST",
      body: {
        sourceMimeType: "image/png",
        sourceName: "reference.png",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to prepare reference image upload",
    });
  });

  it("rate limits repeated reference image upload preparation for the same authenticated user", async () => {
    const buildReq = () => ({
      method: "POST",
      body: {
        sourceMimeType: "image/png",
        sourceName: "reference.png",
      },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    });

    for (let attempt = 0; attempt < 16; attempt += 1) {
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
