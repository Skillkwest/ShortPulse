// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  finalizePreparedMediaUploadForUser,
  prepareMediaUploadForUser,
} from "../mediaUploadService";
import { MAX_UPLOAD_BYTES } from "../mediaUploadPolicy";

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
const MINIMAL_MP3_BYTES = Buffer.from("ID3\u0003\u0000\u0000\u0000\u0000\u0000\u0000", "binary");

describe("prepareMediaUploadForUser", () => {
  const createSignedUploadUrlMock = vi.fn();
  const createSignedUrlMock = vi.fn();
  const downloadMock = vi.fn();
  const uploadMock = vi.fn();
  const moveMock = vi.fn();
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
          move: moveMock,
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
        cacheControl: "31536000",
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

  it("finalizes a staged video upload by moving it into durable storage and preserving variant authority", async () => {
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
    moveMock.mockResolvedValueOnce({
      data: { path: "user-1/videos/moved-clip.mp4" },
      error: null,
    });

    const file = await finalizePreparedMediaUploadForUser({
      userId: "user-1",
      destinationTab: "uploaded_videos",
      storagePath: "user-1/upload-staging/uploaded_videos/clip.mp4",
      filename: "clip.mp4",
      declaredMimeType: "video/mp4",
    });

    expect(uploadMock).not.toHaveBeenCalled();
    expect(moveMock).toHaveBeenCalledWith(
      "user-1/upload-staging/uploaded_videos/clip.mp4",
      expect.stringMatching(/^user-1\/videos\/.*clip\.mp4$/)
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

  it("rejects oversized staged video uploads before moving or persisting media", async () => {
    downloadMock.mockResolvedValueOnce({
      data: {
        size: MAX_UPLOAD_BYTES + 1,
        type: "video/mp4",
        arrayBuffer: vi.fn(),
      },
      error: null,
    });

    await expect(
      finalizePreparedMediaUploadForUser({
        userId: "user-1",
        destinationTab: "uploaded_videos",
        storagePath: "user-1/upload-staging/uploaded_videos/too-large.mp4",
        filename: "too-large.mp4",
        declaredMimeType: "video/mp4",
      })
    ).rejects.toMatchObject({
      status: 413,
      message: "Upload failed: file too large",
    });

    expect(moveMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
    expect(videoVariantMocks.upsertVideoPreviewVariantFromBuffer).not.toHaveBeenCalled();
    expect(videoVariantMocks.upsertVideoPosterVariantFromBuffer).not.toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalledWith([
      "user-1/upload-staging/uploaded_videos/too-large.mp4",
    ]);
  });

  it("finalizes a staged audio upload by moving it into durable storage", async () => {
    downloadMock.mockResolvedValueOnce({
      data: {
        size: MINIMAL_MP3_BYTES.length,
        type: "audio/mpeg",
        arrayBuffer: async () =>
          MINIMAL_MP3_BYTES.buffer.slice(
            MINIMAL_MP3_BYTES.byteOffset,
            MINIMAL_MP3_BYTES.byteOffset + MINIMAL_MP3_BYTES.byteLength
          ),
      },
      error: null,
    });
    moveMock.mockResolvedValueOnce({
      data: { path: "user-1/audio/moved-track.mp3" },
      error: null,
    });

    const file = await finalizePreparedMediaUploadForUser({
      userId: "user-1",
      destinationTab: "uploaded_images",
      storagePath: "user-1/upload-staging/uploaded_images/track.mp3",
      filename: "track.mp3",
      declaredMimeType: "audio/mpeg",
    });

    expect(uploadMock).not.toHaveBeenCalled();
    expect(moveMock).toHaveBeenCalledWith(
      "user-1/upload-staging/uploaded_images/track.mp3",
      expect.stringMatching(/^user-1\/audio\/.*track\.mp3$/)
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        filename: "track.mp3",
        storage_path: expect.stringMatching(/^user-1\/audio\/.*track\.mp3$/),
        file_type: "audio",
        file_size: MINIMAL_MP3_BYTES.length,
        source: "upload",
      })
    );
    expect(videoVariantMocks.upsertVideoPreviewVariantFromBuffer).not.toHaveBeenCalled();
    expect(videoVariantMocks.upsertVideoPosterVariantFromBuffer).not.toHaveBeenCalled();
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/audio\/.*track\.mp3$/),
      3600
    );
    expect(removeMock).toHaveBeenCalledWith(["user-1/upload-staging/uploaded_images/track.mp3"]);
    expect(file).toEqual({
      id: "media-1",
      filename: "track.mp3",
      storage_path: expect.stringMatching(/^user-1\/audio\/.*track\.mp3$/),
      preview_storage_path: expect.stringMatching(/^user-1\/audio\/.*track\.mp3$/),
      file_type: "audio",
      file_size: MINIMAL_MP3_BYTES.length,
      source: "upload",
      created_at: "2026-06-21T00:00:00.000Z",
      signedUrl: expect.stringMatching(/^https:\/\/signed\.example\//),
    });
  });

  it("removes a moved durable upload if signing the finalized audio path fails", async () => {
    downloadMock.mockResolvedValueOnce({
      data: {
        size: MINIMAL_MP3_BYTES.length,
        type: "audio/mpeg",
        arrayBuffer: async () =>
          MINIMAL_MP3_BYTES.buffer.slice(
            MINIMAL_MP3_BYTES.byteOffset,
            MINIMAL_MP3_BYTES.byteOffset + MINIMAL_MP3_BYTES.byteLength
          ),
      },
      error: null,
    });
    moveMock.mockResolvedValueOnce({
      data: { path: "user-1/audio/moved-track.mp3" },
      error: null,
    });
    createSignedUrlMock.mockRejectedValueOnce(new Error("signing failed"));

    await expect(
      finalizePreparedMediaUploadForUser({
        userId: "user-1",
        destinationTab: "uploaded_images",
        storagePath: "user-1/upload-staging/uploaded_images/track.mp3",
        filename: "track.mp3",
        declaredMimeType: "audio/mpeg",
      })
    ).rejects.toMatchObject({
      status: 500,
      message: "Failed to generate signed preview URL",
      details: "signing failed",
    });

    expect(insertMock).not.toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalledWith([
      expect.stringMatching(/^user-1\/audio\/.*track\.mp3$/),
    ]);
    expect(removeMock).toHaveBeenCalledWith(["user-1/upload-staging/uploaded_images/track.mp3"]);
  });

  it("labels prepared upload move failures with finalize diagnostics", async () => {
    downloadMock.mockResolvedValueOnce({
      data: {
        size: MINIMAL_MP3_BYTES.length,
        type: "audio/mpeg",
        arrayBuffer: async () =>
          MINIMAL_MP3_BYTES.buffer.slice(
            MINIMAL_MP3_BYTES.byteOffset,
            MINIMAL_MP3_BYTES.byteOffset + MINIMAL_MP3_BYTES.byteLength
          ),
      },
      error: null,
    });
    moveMock.mockResolvedValueOnce({
      data: null,
      error: { message: "storage move unavailable" },
    });

    await expect(
      finalizePreparedMediaUploadForUser({
        userId: "user-1",
        destinationTab: "uploaded_images",
        storagePath: "user-1/upload-staging/uploaded_images/track.mp3",
        filename: "track.mp3",
        declaredMimeType: "audio/mpeg",
      })
    ).rejects.toMatchObject({
      status: 500,
      message: "Upload failed",
      details: "storage move unavailable",
      diagnostics: {
        media_upload_stage: "prepared_upload_move",
        media_upload_operation: "storage_move",
        media_upload_destination_tab: "uploaded_images",
        media_upload_file_type: "audio",
        media_upload_mime_type: "audio/mpeg",
      },
    });

    expect(insertMock).not.toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalledWith(["user-1/upload-staging/uploaded_images/track.mp3"]);
  });

  it("removes a moved durable audio upload when media row persistence fails", async () => {
    downloadMock.mockResolvedValueOnce({
      data: {
        size: MINIMAL_MP3_BYTES.length,
        type: "audio/mpeg",
        arrayBuffer: async () =>
          MINIMAL_MP3_BYTES.buffer.slice(
            MINIMAL_MP3_BYTES.byteOffset,
            MINIMAL_MP3_BYTES.byteOffset + MINIMAL_MP3_BYTES.byteLength
          ),
      },
      error: null,
    });
    moveMock.mockResolvedValueOnce({
      data: { path: "user-1/audio/moved-track.mp3" },
      error: null,
    });
    insertMock.mockImplementationOnce(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: null,
          error: { message: "insert exploded" },
        })),
      })),
    }));

    await expect(
      finalizePreparedMediaUploadForUser({
        userId: "user-1",
        destinationTab: "uploaded_images",
        storagePath: "user-1/upload-staging/uploaded_images/track.mp3",
        filename: "track.mp3",
        declaredMimeType: "audio/mpeg",
      })
    ).rejects.toMatchObject({
      status: 500,
      message: "Failed to persist media record",
      details: "insert exploded",
      diagnostics: {
        media_upload_stage: "media_row_insert",
        media_upload_operation: "database_insert",
        media_upload_destination_tab: "uploaded_images",
        media_upload_file_type: "audio",
        media_upload_source: "upload",
      },
    });

    expect(removeMock).toHaveBeenCalledWith([
      expect.stringMatching(/^user-1\/audio\/.*track\.mp3$/),
    ]);
    expect(removeMock).toHaveBeenCalledWith(["user-1/upload-staging/uploaded_images/track.mp3"]);
  });
});
