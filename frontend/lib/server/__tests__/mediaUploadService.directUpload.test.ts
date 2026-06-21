import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  finalizePreparedMediaUploadForUser,
  prepareMediaUploadForUser,
} from "../mediaUploadService";

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);
const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

describe("prepareMediaUploadForUser", () => {
  const createSignedUploadUrlMock = vi.fn();
  const createSignedUrlMock = vi.fn();
  const downloadMock = vi.fn();
  const uploadMock = vi.fn();
  const removeMock = vi.fn();
  const insertMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
});
