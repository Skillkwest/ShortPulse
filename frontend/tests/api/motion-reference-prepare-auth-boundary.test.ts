import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/prepare-motion-reference-video-upload";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const enforceApiRateLimitMock = vi.fn();
const prepareMotionReferenceVideoUploadForUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/rateLimit", () => ({
  enforceApiRateLimit: (...args: unknown[]) => enforceApiRateLimitMock(...args),
}));

vi.mock("../../lib/server/mediaUploadService", () => ({
  MediaUploadServiceError: class MediaUploadServiceError extends Error {
    readonly status: number;
    readonly details?: string;

    constructor(status: number, message: string, details?: string) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
  prepareMotionReferenceVideoUploadForUser: (...args: unknown[]) =>
    prepareMotionReferenceVideoUploadForUserMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("motion reference prepare auth boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    enforceApiRateLimitMock.mockReturnValue(true);
  });

  it("logs auth verifier exceptions before rate limit or upload preparation", async () => {
    const authError = new Error("auth verifier unavailable");
    requireApiUserMock.mockRejectedValueOnce(authError);
    const req = {
      method: "POST",
      body: {
        sourceName: "motion-reference.webm",
        sourceMimeType: "video/webm",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(enforceApiRateLimitMock).not.toHaveBeenCalled();
    expect(prepareMotionReferenceVideoUploadForUserMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "media-prepare-motion-reference-video-upload.auth",
      scope: "generation",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to prepare motion reference video upload",
    });
  });
});
