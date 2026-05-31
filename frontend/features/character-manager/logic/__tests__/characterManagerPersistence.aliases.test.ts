import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveCharacterManagerCharacterSheetAssignments,
  saveCharacterManagerSlot,
} from "../characterManagerPersistence";

const {
  resolveSupabaseContextMock,
  createCharacterMediaAssetMock,
  cleanupOrphanedMediaMock,
  getSignedMediaUrlMock,
  admitProductImageAssetFileMock,
} = vi.hoisted(() => ({
  resolveSupabaseContextMock: vi.fn(),
  createCharacterMediaAssetMock: vi.fn(),
  cleanupOrphanedMediaMock: vi.fn(),
  getSignedMediaUrlMock: vi.fn(),
  admitProductImageAssetFileMock: vi.fn(),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: getSignedMediaUrlMock,
  getSignedMediaUrlsBatch: vi.fn(),
  invalidateSignedMediaUrl: vi.fn(),
}));

vi.mock("../../../../lib/productImageAssetAdmissionClient", () => ({
  admitProductImageAssetFile: admitProductImageAssetFileMock,
}));

vi.mock("../characterManagerPersistenceCore", async () => {
  const actual = await vi.importActual("../characterManagerPersistenceCore");
  return {
    ...(actual as object),
    resolveSupabaseContext: resolveSupabaseContextMock,
    createCharacterMediaAsset: createCharacterMediaAssetMock,
    cleanupOrphanedMedia: cleanupOrphanedMediaMock,
  };
});

describe("characterManagerPersistence canonical character sheet persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSignedMediaUrlMock.mockResolvedValue("https://signed.example/reference.png");
  });

  it("saves character sheet assignments with the canonical metadata key only", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        metadata: {
          untouched: "keep-me",
        },
        description: "",
      },
      error: null,
    }));
    const selectEqId = vi.fn(() => ({ maybeSingle }));
    const selectEqUser = vi.fn(() => ({ eq: selectEqId }));
    const updateEqId = vi.fn(async () => ({ error: null }));
    const updateEqUser = vi.fn(() => ({ eq: updateEqId }));
    const update = vi.fn(() => ({ eq: updateEqUser }));
    const select = vi.fn(() => ({ eq: selectEqUser }));
    const from = vi.fn(() => ({
      select,
      update,
    }));

    resolveSupabaseContextMock.mockResolvedValue({
      supabase: { from },
      userId: "user-1",
    });

    await saveCharacterManagerCharacterSheetAssignments({
      characterId: "char-1",
      assignments: {
        portrait: "portrait_close",
        close_up: null,
        front_shot: "front_full",
      },
    });

    expect(update).toHaveBeenCalledWith({
      metadata: {
        untouched: "keep-me",
        character_sheet_assignments: {
          portrait: "portrait_close",
          close_up: null,
          front_shot: "front_full",
        },
      },
    });
  });

  it("saves slot media and reference rows with canonical character sheet ids only", async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const selectEqSlot = vi.fn(() => ({ maybeSingle }));
    const selectEqSheet = vi.fn(() => ({ eq: selectEqSlot }));
    const selectEqUser = vi.fn(() => ({ eq: selectEqSheet }));
    const select = vi.fn(() => ({ eq: selectEqUser }));
    const upsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "character_reference_images") {
        return { select, upsert };
      }
      throw new Error(`Unexpected table lookup: ${table}`);
    });

    const upload = vi.fn(async () => ({ error: null }));
    const remove = vi.fn(async () => ({ error: null }));

    resolveSupabaseContextMock.mockResolvedValue({
      supabase: {
        from,
        storage: {
          from: vi.fn(() => ({
            upload,
            remove,
          })),
        },
      },
      userId: "user-1",
    });
    createCharacterMediaAssetMock.mockResolvedValue({
      id: "media-1",
      createdAt: "2026-05-09T00:00:00.000Z",
    });
    admitProductImageAssetFileMock.mockResolvedValue({
      bucket: "media_library",
      url: "https://signed.example/admitted-reference.png",
      signedUrl: "https://signed.example/admitted-reference.png",
      storagePath: "user-1/characters/char-1/sheet-1/front_full/uploaded-reference.png",
      previewStoragePath: "user-1/characters/char-1/sheet-1/front_full/uploaded-reference.png",
      filename: "reference.png",
      mimeType: "image/png",
      size: 128,
      width: 1024,
      height: 1024,
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
        original_width: 1024,
        original_height: 1024,
        admitted_width: 1024,
        admitted_height: 1024,
        strategy: "passthrough",
        original_preserved: false,
        original_storage_path: null,
        admitted_storage_path: "user-1/characters/char-1/sheet-1/front_full/uploaded-reference.png",
        supabase_transform_used: false,
      },
    });

    const file = new File(["image"], "reference.png", { type: "image/png" });

    await saveCharacterManagerSlot({
      characterId: "char-1",
      characterSheetId: "sheet-1",
      slotKey: "front_full",
      file,
      validationStatus: "pass",
      validationNotes: {
        validatorVersion: 1,
        mimeType: "image/png",
        width: 1024,
        height: 1024,
        aspectRatio: 1,
        sha256: "hash",
        hardErrors: [],
        warnings: [],
        evaluatedAt: "2026-05-09T00:00:00.000Z",
      },
    });

    expect(createCharacterMediaAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          character_sheet_id: "sheet-1",
          slot_key: "front_full",
          role: "character_slot",
          image_admission: expect.objectContaining({
            supabase_transform_used: false,
          }),
        }),
      })
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        character_id: "char-1",
        character_sheet_id: "sheet-1",
        user_id: "user-1",
        slot_key: "front_full",
        character_media_id: "media-1",
      }),
      {
        onConflict: "character_sheet_id,slot_key",
      }
    );
    const firstCreateCharacterMediaCall = createCharacterMediaAssetMock.mock.calls.at(0) as
      | [Record<string, unknown>]
      | undefined;
    const firstUpsertCall = upsert.mock.calls.at(0) as [Record<string, unknown>] | undefined;
    expect(firstCreateCharacterMediaCall?.[0]?.metadata).not.toHaveProperty("reference_pack_id");
    expect(firstUpsertCall?.[0]).not.toHaveProperty("reference_pack_id");
    expect(getSignedMediaUrlMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/characters/char-1/sheet-1/front_full/uploaded-reference.png",
      forceRefresh: true,
    });
    expect(admitProductImageAssetFileMock).toHaveBeenCalledWith({
      intent: "character_slot",
      characterId: "char-1",
      characterSheetId: "sheet-1",
      slotKey: "front_full",
      file,
    });
    expect(upload).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(cleanupOrphanedMediaMock).not.toHaveBeenCalled();
  });
});
