import fs from "fs";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  admitProductImageAssetFromStorageForUser,
  admitProductImageAssetUploadForUser,
  ProductImageAssetAdmissionError,
} from "../productImageAssetAdmission";
import { getSupabaseAdmin } from "../api/supabaseAdmin";

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

let mockFields: Record<string, unknown> = {};
let mockFile = {
  filepath: "/tmp/mock-product-image-asset",
  mimetype: "image/png",
  originalFilename: "profile.png",
};

const formidableFactoryMock = vi.fn(() => ({
  parse: (
    _req: unknown,
    callback: (err: unknown, fields: unknown, files: Record<string, unknown>) => void
  ) => {
    callback(null, mockFields, { file: mockFile });
  },
}));

vi.mock("formidable", () => ({
  default: () => formidableFactoryMock(),
}));

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
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

describe("admitProductImageAssetUploadForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFields = {
      intent: "character_slot",
      characterId: "char-1",
      characterSheetId: "sheet-1",
      slotKey: "front_full",
    };
    mockFile = {
      filepath: "/tmp/mock-product-image-asset",
      mimetype: "image/png",
      originalFilename: "slot.png",
    };
    vi.spyOn(fs, "unlinkSync").mockImplementation(() => undefined);
  });

  it("admits and stores a character slot image under a server-owned path", async () => {
    const image = await sharp({
      create: {
        width: 32,
        height: 24,
        channels: 3,
        background: { r: 100, g: 120, b: 140 },
      },
    })
      .png()
      .toBuffer();
    vi.spyOn(fs, "readFileSync").mockReturnValue(image);
    const { uploadMock, fromMock, sheetQuery } = setupSupabaseAdmin();

    const result = await admitProductImageAssetUploadForUser({
      req: { headers: { "content-type": "multipart/form-data; boundary=x" } } as never,
      userId: "user-1",
    });

    expect(fromMock).toHaveBeenCalledWith("characters");
    expect(fromMock).toHaveBeenCalledWith("character_reference_packs");
    expect(sheetQuery.eq).toHaveBeenCalledWith("character_id", "char-1");
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/characters\/char-1\/sheet-1\/front_full\//),
      image,
      expect.objectContaining({
        contentType: "image/png",
        upsert: false,
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        bucket: "media_library",
        url: "https://signed.example/product-image",
        signedUrl: "https://signed.example/product-image",
        previewStoragePath: result.storagePath,
        filename: "slot.png",
        mimeType: "image/png",
        size: image.length,
        width: 32,
        height: 24,
      })
    );
    expect(result.admissionMetadata).toEqual(
      expect.objectContaining({
        status: "not_required",
        strategy: "passthrough",
        admitted_storage_path: result.storagePath,
        supabase_transform_used: false,
      })
    );
  });

  it("rejects unknown surface intents before writing storage", async () => {
    mockFields = { intent: "freeform_path", characterId: "char-1" };
    vi.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from("not-used"));
    const { uploadMock } = setupSupabaseAdmin();

    await expect(
      admitProductImageAssetUploadForUser({
        req: { headers: { "content-type": "multipart/form-data; boundary=x" } } as never,
        userId: "user-1",
      })
    ).rejects.toMatchObject({
      status: 400,
      message: "Invalid request",
      details: "Unknown image asset intent.",
    } satisfies Partial<ProductImageAssetAdmissionError>);
    expect(uploadMock).not.toHaveBeenCalled();
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
});
