// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  IMAGE_ADMISSION_MAX_BYTES,
  IMAGE_ADMISSION_VARIANT_KIND,
} from "../../imageAdmissionPolicy";
import { resolveProductUseImageReferenceForMediaFile } from "../admittedReferenceImageVariant";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { admitImageBufferForProductUse } from "../imageAdmission";
import {
  createSignedMediaUrl,
  removeScopedMediaStorageObject,
  uploadMediaBufferToStoragePath,
} from "../mediaIngest";

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("../imageAdmission", () => ({
  admitImageBufferForProductUse: vi.fn(),
}));

vi.mock("../mediaIngest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../mediaIngest")>();
  return {
    ...actual,
    createSignedMediaUrl: vi.fn(),
    removeScopedMediaStorageObject: vi.fn(),
    resolveDetectedMediaMimeType: vi.fn(() => "image/png"),
    resolveMediaStorageExtension: vi.fn(() => "jpg"),
    uploadMediaBufferToStoragePath: vi.fn(),
  };
});

type MediaFileFixture = {
  id: string;
  user_id: string;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
};

type VariantFixture = {
  media_file_id: string;
  user_id: string;
  variant_kind: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  status: string;
  metadata: Record<string, unknown> | null;
};

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);
const admitImageBufferForProductUseMock = vi.mocked(admitImageBufferForProductUse);
const createSignedMediaUrlMock = vi.mocked(createSignedMediaUrl);
const uploadMediaBufferToStoragePathMock = vi.mocked(uploadMediaBufferToStoragePath);
const removeScopedMediaStorageObjectMock = vi.mocked(removeScopedMediaStorageObject);

const originalPath = "user-1/generations/images/generated-original.png";
const admittedPath = `user-1/variants/images/media-1/${IMAGE_ADMISSION_VARIANT_KIND}.jpg`;

const baseMediaRow = (): MediaFileFixture => ({
  id: "media-1",
  user_id: "user-1",
  storage_path: originalPath,
  file_type: "image",
  file_size: IMAGE_ADMISSION_MAX_BYTES + 1024,
  source: "ai_studio",
  metadata: { width: 4096, height: 4096 },
});

const baseVariantRow = (): VariantFixture => ({
  media_file_id: "media-1",
  user_id: "user-1",
  variant_kind: IMAGE_ADMISSION_VARIANT_KIND,
  storage_path: admittedPath,
  mime_type: "image/jpeg",
  width: 2048,
  height: 2048,
  byte_size: 1024,
  status: "ready",
  metadata: {
    image_admission: {
      supabase_transform_used: false,
      admitted_storage_path: admittedPath,
    },
  },
});

const setupSupabase = ({
  mediaRow = baseMediaRow(),
  readyVariant = null,
  upsertError = null,
  downloadError = null,
}: {
  mediaRow?: MediaFileFixture | null;
  readyVariant?: VariantFixture | null;
  upsertError?: { message: string } | null;
  downloadError?: { message: string } | null;
} = {}) => {
  const downloadMock = vi.fn(async () => ({
    data: downloadError
      ? null
      : {
          type: "image/png",
          arrayBuffer: async () => Buffer.from("oversized-original").buffer,
        },
    error: downloadError,
  }));

  const mediaMaybeSingleMock = vi.fn(async () => ({ data: mediaRow, error: null }));
  const variantMaybeSingleMock = vi.fn(async () => ({ data: readyVariant, error: null }));
  const upsertPayloads: Record<string, unknown>[] = [];
  const variantSingleMock = vi.fn(async () => ({
    data: upsertError ? null : baseVariantRow(),
    error: upsertError,
  }));
  const upsertMock = vi.fn((payload: Record<string, unknown>) => {
    upsertPayloads.push(payload);
    return {
      select: vi.fn(() => ({
        single: variantSingleMock,
      })),
    };
  });

  type SelectBuilderMock = {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };

  const createSelectBuilder = (singleMock: ReturnType<typeof vi.fn>) => {
    const builder: SelectBuilderMock = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: singleMock,
    };
    return builder;
  };

  const mediaSelectBuilder = createSelectBuilder(mediaMaybeSingleMock);
  const variantSelectBuilder = createSelectBuilder(variantMaybeSingleMock);
  const fromMock = vi.fn((table: string) => {
    if (table === "media_files") return mediaSelectBuilder;
    if (table === "media_asset_variants") {
      return {
        select: vi.fn(() => variantSelectBuilder),
        upsert: upsertMock,
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  getSupabaseAdminMock.mockReturnValue({
    from: fromMock,
    storage: {
      from: vi.fn(() => ({
        download: downloadMock,
      })),
    },
  } as never);

  return {
    downloadMock,
    fromMock,
    mediaSelectBuilder,
    removeMock: removeScopedMediaStorageObjectMock,
    upsertMock,
    upsertPayloads,
  };
};

const mockAdmittedImage = () => {
  admitImageBufferForProductUseMock.mockResolvedValue({
    status: "admitted",
    buffer: Buffer.from("admitted"),
    dimensions: { width: 2048, height: 2048 },
    mimeType: "image/jpeg",
    metadata: {
      version: 1,
      status: "admitted",
      policy: "shortpulse_image_admission_25mb",
      max_bytes: IMAGE_ADMISSION_MAX_BYTES,
      target_bytes: 23 * 1024 * 1024,
      original_bytes: IMAGE_ADMISSION_MAX_BYTES + 1024,
      admitted_bytes: 1024,
      original_mime_type: "image/png",
      admitted_mime_type: "image/jpeg",
      original_width: 4096,
      original_height: 4096,
      admitted_width: 2048,
      admitted_height: 2048,
      strategy: "server_sharp",
      original_preserved: true,
      original_storage_path: originalPath,
      admitted_storage_path: null,
      supabase_transform_used: false,
    },
  });
};

describe("resolveProductUseImageReferenceForMediaFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAdminMock.mockReset();
    admitImageBufferForProductUseMock.mockReset();
    createSignedMediaUrlMock.mockReset();
    uploadMediaBufferToStoragePathMock.mockReset();
    removeScopedMediaStorageObjectMock.mockReset();
    createSignedMediaUrlMock.mockImplementation(
      async (path: string) => `https://signed.test/${encodeURIComponent(path)}`
    );
    uploadMediaBufferToStoragePathMock.mockResolvedValue(undefined);
    removeScopedMediaStorageObjectMock.mockResolvedValue(undefined);
    mockAdmittedImage();
  });

  it("creates a server-derived admitted variant for oversized generated images", async () => {
    const supabase = setupSupabase();

    const result = await resolveProductUseImageReferenceForMediaFile({
      userId: "user-1",
      mediaFileId: "media-1",
    });

    expect(supabase.mediaSelectBuilder.eq).toHaveBeenCalledWith("id", "media-1");
    expect(supabase.mediaSelectBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(uploadMediaBufferToStoragePathMock).toHaveBeenCalledWith({
      storagePath: admittedPath,
      buffer: Buffer.from("admitted"),
      mimeType: "image/jpeg",
      upsert: true,
      cacheControl: "31536000",
    });
    expect(supabase.upsertPayloads[0]).toEqual(
      expect.objectContaining({
        media_file_id: "media-1",
        user_id: "user-1",
        variant_kind: IMAGE_ADMISSION_VARIANT_KIND,
        storage_path: admittedPath,
        status: "ready",
        metadata: expect.objectContaining({
          image_admission: expect.objectContaining({
            admitted_storage_path: admittedPath,
            supabase_transform_used: false,
          }),
        }),
      })
    );
    expect(result.storagePath).toBe(admittedPath);
    expect(result.signedUrl).toContain(encodeURIComponent(admittedPath));
  });

  it("fails closed before reading storage when the media file is not caller-owned", async () => {
    const supabase = setupSupabase({ mediaRow: null });

    await expect(
      resolveProductUseImageReferenceForMediaFile({
        userId: "user-1",
        mediaFileId: "foreign-media",
      })
    ).rejects.toThrow("Media file is not available for this user.");

    expect(supabase.downloadMock).not.toHaveBeenCalled();
    expect(createSignedMediaUrlMock).not.toHaveBeenCalled();
  });

  it("rejects malformed or out-of-scope original storage paths before download", async () => {
    const supabase = setupSupabase({
      mediaRow: {
        ...baseMediaRow(),
        storage_path: "user-2/generations/images/foreign.png",
      },
    });

    await expect(
      resolveProductUseImageReferenceForMediaFile({
        userId: "user-1",
        mediaFileId: "media-1",
      })
    ).rejects.toThrow("Media file storage path: must start with 'user-1/'.");

    expect(supabase.downloadMock).not.toHaveBeenCalled();
    expect(createSignedMediaUrlMock).not.toHaveBeenCalled();
  });

  it("deletes the uploaded derivative when variant upsert fails", async () => {
    setupSupabase({ upsertError: { message: "constraint failed" } });

    await expect(
      resolveProductUseImageReferenceForMediaFile({
        userId: "user-1",
        mediaFileId: "media-1",
      })
    ).rejects.toThrow("Unable to persist admitted image variant: constraint failed");

    expect(uploadMediaBufferToStoragePathMock).toHaveBeenCalled();
    expect(removeScopedMediaStorageObjectMock).toHaveBeenCalledWith(admittedPath);
    expect(createSignedMediaUrlMock).not.toHaveBeenCalled();
  });

  it("leaves the ready variant in place and does not sign the oversized original when signing fails", async () => {
    setupSupabase();
    createSignedMediaUrlMock.mockRejectedValueOnce(new Error("sign failed"));

    await expect(
      resolveProductUseImageReferenceForMediaFile({
        userId: "user-1",
        mediaFileId: "media-1",
      })
    ).rejects.toThrow("sign failed");

    expect(uploadMediaBufferToStoragePathMock).toHaveBeenCalled();
    expect(createSignedMediaUrlMock).toHaveBeenCalledWith(admittedPath, 3600);
    expect(createSignedMediaUrlMock).not.toHaveBeenCalledWith(originalPath, 3600);
    expect(removeScopedMediaStorageObjectMock).not.toHaveBeenCalled();
  });

  it("reuses an existing ready admitted variant without recompressing", async () => {
    const supabase = setupSupabase({ readyVariant: baseVariantRow() });

    const result = await resolveProductUseImageReferenceForMediaFile({
      userId: "user-1",
      mediaFileId: "media-1",
    });

    expect(supabase.downloadMock).not.toHaveBeenCalled();
    expect(admitImageBufferForProductUseMock).not.toHaveBeenCalled();
    expect(uploadMediaBufferToStoragePathMock).not.toHaveBeenCalled();
    expect(result.storagePath).toBe(admittedPath);
  });

  it("does not sign a ready variant row if returned row ownership does not match", async () => {
    setupSupabase({
      readyVariant: {
        ...baseVariantRow(),
        user_id: "user-2",
        storage_path: "user-2/variants/images/media-1/admitted_reference_25mb.jpg",
      },
    });

    await expect(
      resolveProductUseImageReferenceForMediaFile({
        userId: "user-1",
        mediaFileId: "media-1",
      })
    ).rejects.toThrow("Admitted image variant ownership could not be verified.");

    expect(createSignedMediaUrlMock).not.toHaveBeenCalled();
    expect(admitImageBufferForProductUseMock).not.toHaveBeenCalled();
  });

  it("preserves v1 rejection behavior for animated images over the cap", async () => {
    setupSupabase();
    admitImageBufferForProductUseMock.mockResolvedValueOnce({
      status: "rejected",
      reason: "animated_over_cap",
      userMessage:
        "Animated images over 25 MB are not auto-resized yet. Export a smaller animated file or a static frame and try again.",
      metadata: {
        version: 1,
        status: "rejected",
        policy: "shortpulse_image_admission_25mb",
        max_bytes: IMAGE_ADMISSION_MAX_BYTES,
        target_bytes: 23 * 1024 * 1024,
        original_bytes: IMAGE_ADMISSION_MAX_BYTES + 1024,
        admitted_bytes: null,
        original_mime_type: "image/gif",
        admitted_mime_type: null,
        original_width: 4096,
        original_height: 4096,
        admitted_width: null,
        admitted_height: null,
        strategy: "rejected_animated_over_cap",
        original_preserved: true,
        original_storage_path: originalPath,
        admitted_storage_path: null,
        supabase_transform_used: false,
      },
    });

    await expect(
      resolveProductUseImageReferenceForMediaFile({
        userId: "user-1",
        mediaFileId: "media-1",
      })
    ).rejects.toThrow("Animated images over 25 MB are not auto-resized yet.");

    expect(uploadMediaBufferToStoragePathMock).not.toHaveBeenCalled();
    expect(createSignedMediaUrlMock).not.toHaveBeenCalled();
  });
});
