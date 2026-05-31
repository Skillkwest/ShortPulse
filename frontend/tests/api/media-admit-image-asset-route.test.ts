import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/admit-image-asset";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";
import {
  admitProductImageAssetUploadForUser,
  ProductImageAssetAdmissionError,
} from "../../lib/server/productImageAssetAdmission";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const admitProductImageAssetUploadForUserMock = vi.mocked(admitProductImageAssetUploadForUser);

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/productImageAssetAdmission", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/server/productImageAssetAdmission")>();
  return {
    ...actual,
    admitProductImageAssetUploadForUser: vi.fn(),
  };
});

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/media/admit-image-asset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    admitProductImageAssetUploadForUserMock.mockResolvedValue({
      bucket: "media_library",
      url: "https://signed.example/product-image",
      signedUrl: "https://signed.example/product-image",
      storagePath: "user-1/characters/char-1/profile/image.png",
      previewStoragePath: "user-1/characters/char-1/profile/image.png",
      filename: "image.png",
      mimeType: "image/png",
      size: 128,
      width: 32,
      height: 32,
      admissionMetadata: {
        version: 1,
        status: "not_required",
        policy: "shortpulse_image_admission_25mb",
        max_bytes: 25 * 1024 * 1024,
        target_bytes: 23 * 1024 * 1024,
        original_bytes: 128,
        admitted_bytes: 128,
        original_mime_type: "image/png",
        admitted_mime_type: "image/png",
        original_width: 32,
        original_height: 32,
        admitted_width: 32,
        admitted_height: 32,
        strategy: "passthrough",
        original_preserved: false,
        original_storage_path: null,
        admitted_storage_path: "user-1/characters/char-1/profile/image.png",
        supabase_transform_used: false,
      },
    });
  });

  it("requires an authenticated user", async () => {
    requireApiUserMock.mockResolvedValue(null);
    const req = { method: "POST", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(admitProductImageAssetUploadForUserMock).not.toHaveBeenCalled();
  });

  it("returns the admitted asset from the server admission helper", async () => {
    const req = { method: "POST", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(admitProductImageAssetUploadForUserMock).toHaveBeenCalledWith({
      req,
      userId: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      asset: expect.objectContaining({
        storagePath: "user-1/characters/char-1/profile/image.png",
        signedUrl: "https://signed.example/product-image",
      }),
    });
  });

  it("maps admission validation errors without logging them as server faults", async () => {
    admitProductImageAssetUploadForUserMock.mockRejectedValue(
      new ProductImageAssetAdmissionError(400, "Invalid request", "Unknown image asset intent.")
    );
    const req = { method: "POST", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Unknown image asset intent.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });
});
