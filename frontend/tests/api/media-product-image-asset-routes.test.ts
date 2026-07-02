import { beforeEach, describe, expect, it, vi } from "vitest";
import admitFromStorageHandler from "../../pages/api/media/admit-image-asset-from-storage";
import finalizeHandler from "../../pages/api/media/finalize-product-image-asset-upload";
import prepareHandler from "../../pages/api/media/prepare-product-image-asset-upload";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";
import {
  admitProductImageAssetFromStorageForUser,
  finalizePreparedProductImageAssetUploadForUser,
  prepareProductImageAssetUploadForUser,
  ProductImageAssetAdmissionError,
  type ProductImageAssetAdmissionResponse,
} from "../../lib/server/productImageAssetAdmission";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const prepareProductImageAssetUploadForUserMock = vi.mocked(prepareProductImageAssetUploadForUser);
const finalizePreparedProductImageAssetUploadForUserMock = vi.mocked(
  finalizePreparedProductImageAssetUploadForUser
);
const admitProductImageAssetFromStorageForUserMock = vi.mocked(
  admitProductImageAssetFromStorageForUser
);

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
    admitProductImageAssetFromStorageForUser: vi.fn(),
    finalizePreparedProductImageAssetUploadForUser: vi.fn(),
    prepareProductImageAssetUploadForUser: vi.fn(),
  };
});

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const admittedAsset: ProductImageAssetAdmissionResponse = {
  bucket: "media_library" as const,
  url: "https://signed.example/product-image",
  signedUrl: "https://signed.example/product-image",
  storagePath: "user-1/characters/char-1/presets/image.png",
  previewStoragePath: "user-1/characters/char-1/presets/image.png",
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
    admitted_storage_path: "user-1/characters/char-1/presets/image.png",
    supabase_transform_used: false,
  },
};

describe("product image asset API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    prepareProductImageAssetUploadForUserMock.mockResolvedValue({
      path: "user-1/upload-staging/product-image-assets/character_sheet_preset/image.png",
      token: "token-1",
      mimeType: "image/png",
      name: "image.png",
    });
    finalizePreparedProductImageAssetUploadForUserMock.mockResolvedValue(admittedAsset);
    admitProductImageAssetFromStorageForUserMock.mockResolvedValue(admittedAsset);
  });

  it("prepares a browser-direct product image upload target", async () => {
    const req = {
      method: "POST",
      body: {
        characterId: "char-1",
        intent: "character_sheet_preset",
        sourceMimeType: "image/png",
        sourceName: "image.png",
      },
      headers: {},
    };
    const res = createMockResponse();

    await prepareHandler(req as never, res as never);

    expect(prepareProductImageAssetUploadForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      intent: "character_sheet_preset",
      characterId: "char-1",
      characterSheetId: "",
      slotKey: "",
      elementId: "",
      filename: "image.png",
      declaredMimeType: "image/png",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      target: {
        storagePath: "user-1/upload-staging/product-image-assets/character_sheet_preset/image.png",
        uploadToken: "token-1",
        mimeType: "image/png",
        name: "image.png",
      },
    });
  });

  it("logs prepare-route auth verifier exceptions before rate limit or service work", async () => {
    const authError = new Error("auth verifier unavailable");
    requireApiUserMock.mockRejectedValueOnce(authError);
    const req = {
      method: "POST",
      body: {
        characterId: "char-1",
        intent: "character_sheet_preset",
        sourceMimeType: "image/png",
        sourceName: "image.png",
      },
      headers: {},
    };
    const res = createMockResponse();

    await prepareHandler(req as never, res as never);

    expect(prepareProductImageAssetUploadForUserMock).not.toHaveBeenCalled();
    expect(finalizePreparedProductImageAssetUploadForUserMock).not.toHaveBeenCalled();
    expect(admitProductImageAssetFromStorageForUserMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "media-prepare-product-image-asset-upload.auth",
      scope: "app",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to prepare image asset upload" });
  });

  it("finalizes a staged product image upload through server admission", async () => {
    const req = {
      method: "POST",
      body: {
        characterId: "char-1",
        intent: "character_sheet_preset",
        sourceMimeType: "image/png",
        sourceName: "image.png",
        sourceStoragePath:
          "user-1/upload-staging/product-image-assets/character_sheet_preset/image.png",
      },
      headers: {},
    };
    const res = createMockResponse();

    await finalizeHandler(req as never, res as never);

    expect(finalizePreparedProductImageAssetUploadForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      sourceStoragePath:
        "user-1/upload-staging/product-image-assets/character_sheet_preset/image.png",
      intent: "character_sheet_preset",
      characterId: "char-1",
      characterSheetId: "",
      slotKey: "",
      elementId: "",
      filename: "image.png",
      declaredMimeType: "image/png",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ asset: admittedAsset });
  });

  it("logs finalize-route auth verifier exceptions before rate limit or service work", async () => {
    const authError = new Error("auth verifier unavailable");
    requireApiUserMock.mockRejectedValueOnce(authError);
    const req = {
      method: "POST",
      body: {
        characterId: "char-1",
        intent: "character_sheet_preset",
        sourceMimeType: "image/png",
        sourceName: "image.png",
        sourceStoragePath:
          "user-1/upload-staging/product-image-assets/character_sheet_preset/image.png",
      },
      headers: {},
    };
    const res = createMockResponse();

    await finalizeHandler(req as never, res as never);

    expect(prepareProductImageAssetUploadForUserMock).not.toHaveBeenCalled();
    expect(finalizePreparedProductImageAssetUploadForUserMock).not.toHaveBeenCalled();
    expect(admitProductImageAssetFromStorageForUserMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "media-finalize-product-image-asset-upload.auth",
      scope: "app",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to finalize image asset upload" });
  });

  it("admits an owned storage-backed product image without browser reupload", async () => {
    const req = {
      method: "POST",
      body: {
        characterId: "char-1",
        intent: "character_sheet_preset",
        sourceName: "generated.png",
        sourceStoragePath: "user-1/images/generated/generated.png",
      },
      headers: {},
    };
    const res = createMockResponse();

    await admitFromStorageHandler(req as never, res as never);

    expect(admitProductImageAssetFromStorageForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      sourceStoragePath: "user-1/images/generated/generated.png",
      intent: "character_sheet_preset",
      characterId: "char-1",
      characterSheetId: "",
      slotKey: "",
      elementId: "",
      filename: "generated.png",
      declaredMimeType: "",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ asset: admittedAsset });
  });

  it("logs storage-admit auth verifier exceptions before rate limit or service work", async () => {
    const authError = new Error("auth verifier unavailable");
    requireApiUserMock.mockRejectedValueOnce(authError);
    const req = {
      method: "POST",
      body: {
        characterId: "char-1",
        intent: "character_sheet_preset",
        sourceName: "generated.png",
        sourceStoragePath: "user-1/images/generated/generated.png",
      },
      headers: {},
    };
    const res = createMockResponse();

    await admitFromStorageHandler(req as never, res as never);

    expect(prepareProductImageAssetUploadForUserMock).not.toHaveBeenCalled();
    expect(finalizePreparedProductImageAssetUploadForUserMock).not.toHaveBeenCalled();
    expect(admitProductImageAssetFromStorageForUserMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "media-admit-image-asset-from-storage.auth",
      scope: "app",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to admit image asset" });
  });

  it("maps product image validation errors without logging them as server faults", async () => {
    finalizePreparedProductImageAssetUploadForUserMock.mockRejectedValueOnce(
      new ProductImageAssetAdmissionError(
        400,
        "Invalid request",
        "Image asset source storage path is required."
      )
    );
    const req = {
      method: "POST",
      body: {
        characterId: "char-1",
        intent: "character_sheet_preset",
        sourceMimeType: "image/png",
        sourceName: "image.png",
        sourceStoragePath: "",
      },
      headers: {},
    };
    const res = createMockResponse();

    await finalizeHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Image asset source storage path is required.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "prepare",
      prepareHandler,
      prepareProductImageAssetUploadForUserMock,
      {
        characterId: "char-1",
        intent: "character_sheet_preset",
        sourceMimeType: "image/png",
        sourceName: "image.png",
      },
    ],
    [
      "finalize",
      finalizeHandler,
      finalizePreparedProductImageAssetUploadForUserMock,
      {
        characterId: "char-1",
        intent: "character_sheet_preset",
        sourceMimeType: "image/png",
        sourceName: "image.png",
        sourceStoragePath:
          "user-1/upload-staging/product-image-assets/character_sheet_preset/image.png",
      },
    ],
    [
      "admit from storage",
      admitFromStorageHandler,
      admitProductImageAssetFromStorageForUserMock,
      {
        characterId: "char-1",
        intent: "character_sheet_preset",
        sourceName: "generated.png",
        sourceStoragePath: "user-1/images/generated/generated.png",
      },
    ],
  ])(
    "maps %s media agreement failures to a stable route code",
    async (_label, handler, serviceMock, body) => {
      serviceMock.mockRejectedValueOnce(
        new ProductImageAssetAdmissionError(
          403,
          "Media agreement acceptance is required.",
          "Accept the current media agreement before uploading or staging media.",
          "MEDIA_COMPLIANCE_REQUIRED"
        )
      );
      const req = {
        method: "POST",
        body,
        headers: {},
      };
      const res = createMockResponse();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Media agreement acceptance is required.",
        details: "Accept the current media agreement before uploading or staging media.",
        code: "MEDIA_COMPLIANCE_REQUIRED",
      });
      expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    }
  );

  it("logs unexpected product image route failures with the owning route label", async () => {
    admitProductImageAssetFromStorageForUserMock.mockRejectedValueOnce(
      new Error("storage copy exploded")
    );
    const req = {
      method: "POST",
      body: {
        characterId: "char-1",
        intent: "character_sheet_preset",
        sourceStoragePath: "user-1/images/generated/generated.png",
      },
      headers: {},
    };
    const res = createMockResponse();

    await admitFromStorageHandler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "media-admit-image-asset-from-storage",
      user: { id: "user-1", email: "u@example.com" },
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to admit image asset" });
  });
});
