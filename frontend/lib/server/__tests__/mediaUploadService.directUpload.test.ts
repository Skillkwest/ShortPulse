import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  finalizePreparedMediaUploadForUser,
  prepareMediaUploadForUser,
} from "../mediaUploadService";

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const videoVariantMocks = vi.hoisted(() => ({
  upsertVideoPosterVariantFromBuffer: vi.fn(),
  upsertVideoPreviewVariantFromBuffer: vi.fn(),
}));
const mediaComplianceAcceptanceMocks = vi.hoisted(() => ({
  getMediaComplianceAcceptanceStatusForUser: vi.fn(),
  isMediaComplianceUnavailableError: vi.fn(),
}));

vi.mock("../videoPosterVariant", () => ({
  upsertVideoPosterVariantFromBuffer: videoVariantMocks.upsertVideoPosterVariantFromBuffer,
  upsertVideoPreviewVariantFromBuffer: videoVariantMocks.upsertVideoPreviewVariantFromBuffer,
}));

vi.mock("../api/mediaComplianceAcceptance", () => ({
  getMediaComplianceAcceptanceStatusForUser:
    mediaComplianceAcceptanceMocks.getMediaComplianceAcceptanceStatusForUser,
  isMediaComplianceUnavailableError:
    mediaComplianceAcceptanceMocks.isMediaComplianceUnavailableError,
}));

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);
const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);
const MINIMAL_MP4_BYTES = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from("ftypmp42", "ascii"),
]);

describe("prepareMediaUploadForUser", () => {
  const createSignedUploadUrlMock = vi.fn();
  const createSignedUrlMock = vi.fn();
  const downloadMock = vi.fn();
  const uploadMock = vi.fn();
  const removeMock = vi.fn();
  const insertMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    videoVariantMocks.upsertVideoPosterVariantFromBuffer.mockResolvedValue(null);
    videoVariantMocks.upsertVideoPreviewVariantFromBuffer.mockResolvedValue(null);
    mediaComplianceAcceptanceMocks.getMediaComplianceAcceptanceStatusForUser.mockResolvedValue({
      accepted: true,
      acceptedAt: "2026-06-29T00:00:00.000Z",
    });
    mediaComplianceAcceptanceMocks.isMediaComplianceUnavailableError.mockReturnValue(false);
    let insertedMediaPayload: {
      filename: string;
      storage_path: string;
      file_type: string;
      file_size: number;
      source: string;
      metadata: Record<string, unknown> | null;
      user_id: string;
    } | null = null;
    insertMock.mockImplementation((payload: typeof insertedMediaPayload) => {
      insertedMediaPayload = payload;
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: insertedMediaPayload
              ? {
                  id: "media-1",
                  user_id: insertedMediaPayload.user_id,
                  filename: insertedMediaPayload.filename,
                  storage_path: insertedMediaPayload.storage_path,
                  file_type: insertedMediaPayload.file_type,
                  file_size: insertedMediaPayload.file_size,
                  source: insertedMediaPayload.source,
                  created_at: "2026-06-21T00:00:00.000Z",
                  metadata: insertedMediaPayload.metadata,
                  thumb_variant_path: null,
                  poster_variant_path: null,
                  preview_variant_path: null,
                }
              : null,
            error: null,
          })),
        })),
      };
    });
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUploadUrl: createSignedUploadUrlMock,
          createSignedUrl: createSignedUrlMock,
          download: downloadMock,
          upload: uploadMock,
          remove: removeMock,
        })),
      },
      from: vi.fn(() => ({
        insert: insertMock,
      })),
    } as never);
    downloadMock.mockResolvedValue({
      data: {
        size: ONE_BY_ONE_PNG.length,
        type: "image/png",
        arrayBuffer: async () =>
          ONE_BY_ONE_PNG.buffer.slice(
            ONE_BY_ONE_PNG.byteOffset,
            ONE_BY_ONE_PNG.byteOffset + ONE_BY_ONE_PNG.byteLength
          ),
      },
      error: null,
    });
    uploadMock.mockResolvedValue({ error: null });
    removeMock.mockResolvedValue({ error: null });
    createSignedUrlMock.mockImplementation(async (storagePath: string) => ({
      data: {
        signedUrl: `https://signed.example/${encodeURIComponent(storagePath)}`,
      },
      error: null,
    }));
  });

  it("returns the server-scoped signed upload path", async () => {
    createSignedUploadUrlMock.mockImplementation(async (storagePath: string) => ({
      data: {
        path: storagePath,
        token: "upload-token",
      },
      error: null,
    }));

    const target = await prepareMediaUploadForUser({
      userId: "user-1",
      destinationTab: "uploaded_images",
      filename: "reference.webp",
      declaredMimeType: "image/webp",
    });

    expect(createSignedUploadUrlMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/upload-staging\/uploaded_images\/.*reference\.webp$/)
    );
    expect(target).toEqual({
      path: expect.stringMatching(/^user-1\/upload-staging\/uploaded_images\/.*reference\.webp$/),
      token: "upload-token",
      mimeType: "image/webp",
      name: "reference.webp",
    });
  });

  it("rejects upload target creation when media consent has not been accepted", async () => {
    mediaComplianceAcceptanceMocks.getMediaComplianceAcceptanceStatusForUser.mockResolvedValueOnce({
      accepted: false,
      acceptedAt: null,
    });

    await expect(
      prepareMediaUploadForUser({
        userId: "user-1",
        destinationTab: "uploaded_images",
        filename: "reference.webp",
        declaredMimeType: "image/webp",
      })
    ).rejects.toMatchObject({
      status: 403,
      message: "Media agreement acceptance is required.",
      details: "Accept the current media agreement before uploading or staging media.",
    });
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled();
  });

  it("fails closed when the signed upload path differs from the requested path", async () => {
    createSignedUploadUrlMock.mockResolvedValueOnce({
      data: {
        path: "user-2/upload-staging/uploaded_images/reference.webp",
        token: "upload-token",
      },
      error: null,
    });

    await expect(
      prepareMediaUploadForUser({
        userId: "user-1",
        destinationTab: "uploaded_images",
        filename: "reference.webp",
        declaredMimeType: "image/webp",
      })
    ).rejects.toMatchObject({
      status: 500,
      message: "Unable to prepare media upload",
      details: "Signed upload target path did not match requested storage path.",
    });
  });

  it("finalizes a staged browser upload into a durable media row and removes staging", async () => {
    const file = await finalizePreparedMediaUploadForUser({
      userId: "user-1",
      destinationTab: "uploaded_images",
      storagePath: "user-1/upload-staging/uploaded_images/reference.png",
      filename: "reference.png",
      declaredMimeType: "image/png",
    });

    expect(downloadMock).toHaveBeenCalledWith(
      "user-1/upload-staging/uploaded_images/reference.png"
    );
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/images\/.*reference\.png$/),
      ONE_BY_ONE_PNG,
      {
        contentType: "image/png",
        upsert: false,
      }
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        filename: "reference.png",
        storage_path: expect.stringMatching(/^user-1\/images\/.*reference\.png$/),
        file_type: "image",
        file_size: ONE_BY_ONE_PNG.length,
        source: "upload",
        metadata: expect.objectContaining({
          width: 1,
          height: 1,
          aspect_ratio: 1,
          dimension_status: "known",
          dimension_source: "extracted",
        }),
      })
    );
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/images\/.*reference\.png$/),
      3600
    );
    expect(removeMock).toHaveBeenCalledWith([
      "user-1/upload-staging/uploaded_images/reference.png",
    ]);
    expect(file).toEqual({
      id: "media-1",
      filename: "reference.png",
      storage_path: expect.stringMatching(/^user-1\/images\/.*reference\.png$/),
      preview_storage_path: expect.stringMatching(/^user-1\/images\/.*reference\.png$/),
      file_type: "image",
      file_size: ONE_BY_ONE_PNG.length,
      source: "upload",
      created_at: "2026-06-21T00:00:00.000Z",
      signedUrl: expect.stringMatching(/^https:\/\/signed\.example\//),
    });
  });

  it("finalizes a staged video upload with durable preview and poster variant authority", async () => {
    videoVariantMocks.upsertVideoPreviewVariantFromBuffer.mockResolvedValueOnce(
      "user-1/variants/videos/media-1/preview_loop_360p.mp4"
    );
    videoVariantMocks.upsertVideoPosterVariantFromBuffer.mockResolvedValueOnce(
      "user-1/variants/videos/media-1/poster_720.jpg"
    );
    downloadMock.mockResolvedValueOnce({
      data: {
        size: MINIMAL_MP4_BYTES.length,
        type: "video/mp4",
        arrayBuffer: async () =>
          MINIMAL_MP4_BYTES.buffer.slice(
            MINIMAL_MP4_BYTES.byteOffset,
            MINIMAL_MP4_BYTES.byteOffset + MINIMAL_MP4_BYTES.byteLength
          ),
      },
      error: null,
    });

    const file = await finalizePreparedMediaUploadForUser({
      userId: "user-1",
      destinationTab: "uploaded_videos",
      storagePath: "user-1/upload-staging/uploaded_videos/clip.mp4",
      filename: "clip.mp4",
      declaredMimeType: "video/mp4",
    });

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/videos\/.*clip\.mp4$/),
      MINIMAL_MP4_BYTES,
      {
        contentType: "video/mp4",
        upsert: false,
      }
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        filename: "clip.mp4",
        storage_path: expect.stringMatching(/^user-1\/videos\/.*clip\.mp4$/),
        file_type: "video",
        file_size: MINIMAL_MP4_BYTES.length,
        source: "upload",
      })
    );
    expect(videoVariantMocks.upsertVideoPreviewVariantFromBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        mediaFileId: "media-1",
        videoBuffer: MINIMAL_MP4_BYTES,
        videoMimeType: "video/mp4",
        filename: "clip.mp4",
        metadata: {
          generated_by: "media_upload_service",
          upload_source: "upload",
        },
      })
    );
    expect(videoVariantMocks.upsertVideoPosterVariantFromBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        mediaFileId: "media-1",
        videoBuffer: MINIMAL_MP4_BYTES,
        videoMimeType: "video/mp4",
        filename: "clip.mp4",
        metadata: {
          generated_by: "media_upload_service",
          upload_source: "upload",
        },
      })
    );
    expect(createSignedUrlMock).toHaveBeenLastCalledWith(
      "user-1/variants/videos/media-1/preview_loop_360p.mp4",
      3600
    );
    expect(removeMock).toHaveBeenCalledWith(["user-1/upload-staging/uploaded_videos/clip.mp4"]);
    expect(file).toEqual({
      id: "media-1",
      filename: "clip.mp4",
      storage_path: expect.stringMatching(/^user-1\/videos\/.*clip\.mp4$/),
      preview_storage_path: "user-1/variants/videos/media-1/preview_loop_360p.mp4",
      file_type: "video",
      file_size: MINIMAL_MP4_BYTES.length,
      source: "upload",
      created_at: "2026-06-21T00:00:00.000Z",
      signedUrl:
        "https://signed.example/user-1%2Fvariants%2Fvideos%2Fmedia-1%2Fpreview_loop_360p.mp4",
    });
  });
});
