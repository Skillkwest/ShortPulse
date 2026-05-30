import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/prepare-upload";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const prepareMediaUploadForUserMock = vi.fn();

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
    prepareMediaUploadForUser: (...args: unknown[]) => prepareMediaUploadForUserMock(...args),
  };
});

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/media/prepare-upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    prepareMediaUploadForUserMock.mockResolvedValue({
      path: "user-1/upload-staging/uploaded_images/image.webp",
      token: "token-1",
      mimeType: "image/webp",
      name: "image.webp",
    });
  });

  it("returns a signed upload target for a media upload", async () => {
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

    expect(prepareMediaUploadForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      destinationTab: "uploaded_images",
      filename: "image.webp",
      declaredMimeType: "image/webp",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      target: {
        storagePath: "user-1/upload-staging/uploaded_images/image.webp",
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
});
