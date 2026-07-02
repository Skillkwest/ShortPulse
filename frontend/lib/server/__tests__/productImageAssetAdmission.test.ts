import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  admitProductImageAssetFromStorageForUser,
  finalizePreparedProductImageAssetUploadForUser,
  prepareProductImageAssetUploadForUser,
} from "../productImageAssetAdmission";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { getMediaComplianceAcceptanceStatusForUser } from "../api/mediaComplianceAcceptance";

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);
const getMediaComplianceAcceptanceStatusForUserMock = vi.mocked(
  getMediaComplianceAcceptanceStatusForUser
);

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("../api/mediaComplianceAcceptance", () => ({
  getMediaComplianceAcceptanceStatusForUser: vi.fn(),
  isMediaComplianceUnavailableError: (error: unknown) =>
    Boolean(error && typeof error === "object" && (error as { code?: unknown }).code),
}));

const createQueryMock = (result: { data: unknown; error: { message: string } | null }) => {
  const query: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
  };
  return query;
};

const setupSupabaseAdmin = () => {
  const uploadMock = vi.fn(async () => ({ error: null }));
  const downloadMock = vi.fn(async () => ({ data: new Blob(["unused"]), error: null }));
  const removeMock = vi.fn(async () => ({ error: null }));
  const createSignedUploadUrlMock = vi.fn(async (storagePath: string) => ({
    data: { path: storagePath, token: "upload-token" },
    error: null,
  }));
  const createSignedUrlMock = vi.fn(async () => ({
    data: { signedUrl: "https://signed.example/product-image" },
    error: null,
  }));
  const characterQuery = createQueryMock({ data: { id: "char-1" }, error: null });
  const sheetQuery = createQueryMock({ data: { id: "sheet-1" }, error: null });
  const elementQuery = createQueryMock({ data: { id: "element-1" }, error: null });
  const fromMock = vi.fn((table: string) => {
    if (table === "characters") return characterQuery;
    if (table === "character_reference_packs") return sheetQuery;
    if (table === "elements") return elementQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  getSupabaseAdminMock.mockReturnValue({
    from: fromMock,
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        download: downloadMock,
        remove: removeMock,
        createSignedUploadUrl: createSignedUploadUrlMock,
        createSignedUrl: createSignedUrlMock,
      })),
    },
  } as never);

  return {
    uploadMock,
    downloadMock,
    removeMock,
    createSignedUploadUrlMock,
    createSignedUrlMock,
    fromMock,
    characterQuery,
    sheetQuery,
    elementQuery,
  };
};

describe("admitProductImageAssetFromStorageForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMediaComplianceAcceptanceStatusForUserMock.mockResolvedValue({
      accepted: true,
      acceptedAt: "2026-07-01T00:00:00.000Z",
    });
  });

  it("admits a character look by copying from an owned storage path", async () => {
    const image = await sharp({
      create: {
        width: 40,
        height: 40,
        channels: 3,
        background: { r: 90, g: 80, b: 70 },
      },
    })
      .png()
      .toBuffer();
    const { downloadMock, uploadMock, fromMock } = setupSupabaseAdmin();
    downloadMock.mockResolvedValue({
      data: image as never,
      error: null,
    });

    const result = await admitProductImageAssetFromStorageForUser({
      userId: "user-1",
      sourceStoragePath: "user-1/generations/images/source.png",
      intent: "character_sheet_preset",
      characterId: "char-1",
      filename: "source.png",
    });

    expect(downloadMock).toHaveBeenCalledWith("user-1/generations/images/source.png");
    expect(fromMock).toHaveBeenCalledWith("characters");
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/characters\/char-1\/presets\//),
      image,
      expect.objectContaining({
        contentType: "image/png",
        upsert: false,
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        filename: "source.png",
        mimeType: "image/png",
        size: image.length,
        width: 40,
        height: 40,
      })
    );
  });

  it("fails closed when a prepared upload target returns a different storage path", async () => {
    const { createSignedUploadUrlMock } = setupSupabaseAdmin();
    createSignedUploadUrlMock.mockResolvedValueOnce({
      data: {
        path: "user-2/upload-staging/product-image-assets/character_sheet_preset/source.png",
        token: "upload-token",
      },
      error: null,
    });

    await expect(
      prepareProductImageAssetUploadForUser({
        userId: "user-1",
        intent: "character_sheet_preset",
        characterId: "char-1",
        filename: "source.png",
        declaredMimeType: "image/png",
      })
    ).rejects.toThrow("Signed upload target path did not match requested storage path.");
  });

  it.each([
    [
      "prepare",
      () =>
        prepareProductImageAssetUploadForUser({
          userId: "user-1",
          intent: "character_sheet_preset",
          characterId: "char-1",
          filename: "source.png",
          declaredMimeType: "image/png",
        }),
    ],
    [
      "finalize",
      () =>
        finalizePreparedProductImageAssetUploadForUser({
          userId: "user-1",
          sourceStoragePath:
            "user-1/upload-staging/product-image-assets/character_sheet_preset/source.png",
          intent: "character_sheet_preset",
          characterId: "char-1",
          filename: "source.png",
          declaredMimeType: "image/png",
        }),
    ],
    [
      "admit from storage",
      () =>
        admitProductImageAssetFromStorageForUser({
          userId: "user-1",
          sourceStoragePath: "user-1/generations/images/source.png",
          intent: "character_sheet_preset",
          characterId: "char-1",
          filename: "source.png",
        }),
    ],
  ])("requires media agreement acceptance before %s side effects", async (_label, action) => {
    getMediaComplianceAcceptanceStatusForUserMock.mockResolvedValueOnce({
      accepted: false,
      acceptedAt: null,
    });

    await expect(action()).rejects.toMatchObject({
      status: 403,
      message: "Media agreement acceptance is required.",
      details: "Accept the current media agreement before uploading or staging media.",
      code: "MEDIA_COMPLIANCE_REQUIRED",
    });
    expect(getMediaComplianceAcceptanceStatusForUserMock).toHaveBeenCalledWith("user-1");
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("fails closed before storage work when media agreement status is unavailable", async () => {
    const unavailableError = new Error("media compliance unavailable") as Error & { code: string };
    unavailableError.code = "MEDIA_COMPLIANCE_UNAVAILABLE";
    getMediaComplianceAcceptanceStatusForUserMock.mockRejectedValueOnce(unavailableError);

    await expect(
      prepareProductImageAssetUploadForUser({
        userId: "user-1",
        intent: "character_sheet_preset",
        characterId: "char-1",
        filename: "source.png",
        declaredMimeType: "image/png",
      })
    ).rejects.toMatchObject({
      status: 503,
      message: "Media agreement service is temporarily unavailable.",
      details: "Media agreement acceptance could not be verified.",
      code: "MEDIA_COMPLIANCE_UNAVAILABLE",
    });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });
});
