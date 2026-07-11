import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyMediaFolderMembershipBatch,
  createMediaFolder,
  deleteMediaFolder,
  fetchMediaPromptListPage,
  listMediaFolders,
  moveMediaFolder,
  renameMediaFolder,
  uploadMediaFile,
} from "../mediaLibraryPanelApi";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const maybeTranscodeLocalImageBlobForUploadMock = vi.hoisted(() => vi.fn());
const uploadToSignedUrlMock = vi.hoisted(() => vi.fn());
const storageFromMock = vi.hoisted(() =>
  vi.fn(() => ({ uploadToSignedUrl: uploadToSignedUrlMock }))
);
const ensureSupabaseQueryClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    storage: { from: storageFromMock },
  }))
);

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../../../../lib/adaptive-media", () => ({
  maybeTranscodeLocalImageBlobForUpload: (...args: unknown[]) =>
    maybeTranscodeLocalImageBlobForUploadMock(...args),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: () => ensureSupabaseQueryClientMock(),
}));

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("mediaLibraryPanelApi transient retry hardening", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
    maybeTranscodeLocalImageBlobForUploadMock.mockReset();
    uploadToSignedUrlMock.mockReset();
    storageFromMock.mockClear();
    ensureSupabaseQueryClientMock.mockClear();
    maybeTranscodeLocalImageBlobForUploadMock.mockImplementation(async (blob: Blob) => blob);
  });

  it("retries transient network failures for membership-batch calls", async () => {
    fetchWithAuthMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          action: "assign",
          folderId: "folder-1",
          sourceFolderId: null,
          targetFolderId: "folder-1",
          mediaAssigned: 1,
          mediaUnassigned: 0,
          promptsAssigned: 0,
          promptsUnassigned: 0,
          mediaDuplicates: 0,
          promptDuplicates: 0,
          mediaSkipped: 0,
          promptSkipped: 0,
        }),
      });

    const result = await applyMediaFolderMembershipBatch({
      action: "assign",
      folderId: "folder-1",
      mediaIds: ["media-1"],
      promptIds: [],
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      action: "assign",
      folderId: "folder-1",
      mediaAssigned: 1,
    });
  });

  it("does not retry non-transient membership errors", async () => {
    fetchWithAuthMock.mockRejectedValueOnce(new Error("forbidden"));

    await expect(
      applyMediaFolderMembershipBatch({
        action: "assign",
        folderId: "folder-1",
        mediaIds: ["media-1"],
        promptIds: [],
      })
    ).rejects.toThrow("forbidden");
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient prompt-list fetch failures", async () => {
    fetchWithAuthMock
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rows: [
            {
              id: "prompt-1",
              title: "Prompt One",
              prompt_text: "Prompt text",
              mode: "text",
              source: "manual",
              created_at: "2026-03-14T00:00:00.000Z",
              updated_at: "2026-03-14T00:00:00.000Z",
            },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      });

    const result = await fetchMediaPromptListPage({
      folderId: "all_items",
      query: "",
      cursor: null,
      limit: 20,
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe("prompt-1");
  });

  it("retries transient folder-list failures", async () => {
    fetchWithAuthMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          folders: [
            {
              id: "folder-1",
              name: "Campaign",
              createdAt: "2026-03-01T00:00:00.000Z",
              updatedAt: "2026-03-01T00:00:00.000Z",
              itemCount: 4,
            },
          ],
        }),
      });

    const folders = await listMediaFolders();
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(folders.map((folder) => folder.id)).toEqual(["folder-1"]);
    expect(folders[0]?.itemCount).toBe(4);
  });

  it("preserves folder-list HTTP status on non-OK responses", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(jsonResponse({ error: "Project not found" }, 404));

    await expect(listMediaFolders("project-1")).rejects.toMatchObject({
      message: "Project not found",
      status: 404,
    });
  });

  it("uses global folder routes even when a projectId is provided", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        folders: [
          {
            id: "folder-1",
            name: "Campaign",
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z",
            itemCount: 6,
          },
        ],
      }),
    });

    const folders = await listMediaFolders("project-1");

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/folders/list",
      expect.objectContaining({
        method: "GET",
      })
    );
    expect(folders[0]?.itemCount).toBe(6);
  });

  it("uses global membership routes even when a projectId is provided", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        action: "assign",
        folderId: "folder-1",
        sourceFolderId: null,
        targetFolderId: "folder-1",
        mediaAssigned: 1,
        mediaUnassigned: 0,
        promptsAssigned: 0,
        promptsUnassigned: 0,
        mediaDuplicates: 0,
        promptDuplicates: 0,
        mediaSkipped: 0,
        promptSkipped: 0,
      }),
    });

    await applyMediaFolderMembershipBatch(
      {
        action: "assign",
        folderId: "folder-1",
        mediaIds: ["media-1"],
        promptIds: [],
      },
      "project-1"
    );

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/folders/membership-batch",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("retries transient folder-move failures", async () => {
    fetchWithAuthMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(
      jsonResponse({
        folder: {
          id: "folder-1",
          name: "Campaign",
          parentFolderId: null,
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-02T00:00:00.000Z",
          itemCount: 4,
        },
      })
    );

    const folder = await moveMediaFolder({
      folderId: "folder-1",
      parentFolderId: null,
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(folder).toMatchObject({
      id: "folder-1",
      parentFolderId: null,
    });
  });

  it("does not retry transient folder-create failures", async () => {
    fetchWithAuthMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(createMediaFolder("Created")).rejects.toThrow("Failed to fetch");
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry transient folder-delete failures", async () => {
    fetchWithAuthMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(deleteMediaFolder("folder-create")).rejects.toThrow("Failed to fetch");
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
  });

  it("preserves folder-move HTTP status on non-OK responses", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({ error: "Parent folder not found" }, 404)
    );

    await expect(
      moveMediaFolder({
        folderId: "folder-1",
        parentFolderId: "folder-parent",
      })
    ).rejects.toMatchObject({
      message: "Parent folder not found",
      status: 404,
    });
  });

  it("retries transient folder-rename failures", async () => {
    fetchWithAuthMock
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(
        jsonResponse({
          folder: {
            id: "folder-create",
            name: "Renamed",
            parentFolderId: null,
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-02T00:00:00.000Z",
            itemCount: 0,
          },
        })
      );
    await expect(
      renameMediaFolder({
        folderId: "folder-create",
        name: "Renamed",
      })
    ).resolves.toMatchObject({
      name: "Renamed",
    });
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
  });

  it("keeps prompt-list requests on the global media prompt route when projectId is provided", async () => {
    const controller = new AbortController();
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rows: [],
        nextCursor: null,
        hasMore: false,
      }),
    });

    await fetchMediaPromptListPage({
      folderId: "folder-1",
      projectId: "project-1",
      query: "",
      cursor: null,
      limit: 20,
      signal: controller.signal,
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/prompts/list",
      expect.objectContaining({
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ folderId: "folder-1", query: "", cursor: null, limit: 20 }),
      })
    );
  });

  it("does not retry caller-aborted prompt-list requests", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    fetchWithAuthMock.mockRejectedValueOnce(abortError);

    await expect(
      fetchMediaPromptListPage({
        folderId: "folder-1",
        query: "",
        cursor: null,
        limit: 20,
        signal: new AbortController().signal,
      })
    ).rejects.toBe(abortError);

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
  });
});

describe("mediaLibraryPanelApi.uploadMediaFile", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
    maybeTranscodeLocalImageBlobForUploadMock.mockReset();
    uploadToSignedUrlMock.mockReset();
    storageFromMock.mockClear();
    ensureSupabaseQueryClientMock.mockClear();
    maybeTranscodeLocalImageBlobForUploadMock.mockImplementation(async (blob: Blob) => blob);
    uploadToSignedUrlMock.mockResolvedValue({ data: { path: "uploaded" }, error: null });
  });

  it("preprocesses local image uploads before direct storage upload and finalize", async () => {
    const sourceFile = new File(["raw-image"], "large-reference.png", {
      type: "image/png",
      lastModified: 123,
    });
    const transcodedBlob = new Blob(["smaller-image"], { type: "image/webp" });
    maybeTranscodeLocalImageBlobForUploadMock.mockResolvedValueOnce(transcodedBlob);
    fetchWithAuthMock
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            intentId: "intent-1",
            bucketId: "media_upload_staging",
            storagePath: "user-1/upload-staging/uploaded_images/large-reference.webp",
            uploadToken: "token-1",
            mimeType: "image/webp",
            name: "large-reference.png",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          file: {
            id: "media-1",
            filename: "large-reference.png",
            storage_path: "user-1/uploads/images/large-reference.webp",
            preview_storage_path: "user-1/uploads/images/large-reference.webp",
            file_type: "image",
            file_size: transcodedBlob.size,
            source: "upload",
            created_at: "2026-05-25T00:00:00.000Z",
            signedUrl: "https://signed.test/large-reference.webp",
          },
        })
      );

    await uploadMediaFile({
      file: sourceFile,
      destinationTab: "uploaded_images",
    });

    expect(maybeTranscodeLocalImageBlobForUploadMock).toHaveBeenCalledWith(sourceFile);
    expect(storageFromMock).toHaveBeenCalledWith("media_upload_staging");
    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      1,
      "/api/media/prepare-upload",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"destinationTab":"uploaded_images"'),
      })
    );
    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/upload-staging/uploaded_images/large-reference.webp",
      "token-1",
      expect.objectContaining({
        name: "large-reference.png",
        type: "image/webp",
      }),
      expect.objectContaining({
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      })
    );
    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      2,
      "/api/media/finalize-upload",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(
          '"intentId":"intent-1","destinationTab":"uploaded_images","sourceMimeType":"image/webp","sourceName":"large-reference.png","sourceStoragePath":"user-1/upload-staging/uploaded_images/large-reference.webp"'
        ),
      })
    );
  });

  it("recovers signed storage signature mismatches with a fresh upload target", async () => {
    const sourceFile = new File(["raw-image"], "screenshot.png", {
      type: "image/png",
      lastModified: 123,
    });
    fetchWithAuthMock
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            intentId: "intent-1",
            bucketId: "media_upload_staging",
            storagePath: "user-1/upload-staging/uploaded_images/screenshot-first.png",
            uploadToken: "token-1",
            mimeType: "image/png",
            name: "screenshot.png",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            intentId: "intent-2",
            bucketId: "media_upload_staging",
            storagePath: "user-1/upload-staging/uploaded_images/screenshot-second.png",
            uploadToken: "token-2",
            mimeType: "image/png",
            name: "screenshot.png",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          file: {
            id: "media-2",
            filename: "screenshot.png",
            storage_path: "user-1/uploads/images/screenshot.png",
            preview_storage_path: "user-1/uploads/images/screenshot.png",
            file_type: "image",
            file_size: sourceFile.size,
            source: "upload",
            created_at: "2026-07-11T16:45:00.000Z",
            signedUrl: "https://signed.test/screenshot.png",
          },
        })
      );
    uploadToSignedUrlMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Invalid signature" },
      })
      .mockResolvedValueOnce({ data: { path: "uploaded" }, error: null });

    const result = await uploadMediaFile({
      file: sourceFile,
      destinationTab: "uploaded_images",
    });

    expect(result.id).toBe("media-2");
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(3);
    expect(uploadToSignedUrlMock).toHaveBeenCalledTimes(2);
    expect(uploadToSignedUrlMock).toHaveBeenNthCalledWith(
      1,
      "user-1/upload-staging/uploaded_images/screenshot-first.png",
      "token-1",
      sourceFile,
      expect.objectContaining({
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: false,
      })
    );
    expect(uploadToSignedUrlMock).toHaveBeenNthCalledWith(
      2,
      "user-1/upload-staging/uploaded_images/screenshot-second.png",
      "token-2",
      sourceFile,
      expect.objectContaining({
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: false,
      })
    );
    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      3,
      "/api/media/finalize-upload",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(
          '"intentId":"intent-2","destinationTab":"uploaded_images","sourceMimeType":"image/png","sourceName":"screenshot.png","sourceStoragePath":"user-1/upload-staging/uploaded_images/screenshot-second.png"'
        ),
      })
    );
  });

  it("stops after one fresh target when signed storage still rejects the signature", async () => {
    const sourceFile = new File(["raw-image"], "screenshot.png", {
      type: "image/png",
    });
    fetchWithAuthMock
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            intentId: "intent-1",
            bucketId: "media_upload_staging",
            storagePath: "user-1/upload-staging/uploaded_images/screenshot-first.png",
            uploadToken: "token-1",
            mimeType: "image/png",
            name: "screenshot.png",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            intentId: "intent-2",
            bucketId: "media_upload_staging",
            storagePath: "user-1/upload-staging/uploaded_images/screenshot-second.png",
            uploadToken: "token-2",
            mimeType: "image/png",
            name: "screenshot.png",
          },
        })
      );
    uploadToSignedUrlMock.mockResolvedValue({
      data: null,
      error: { message: "Invalid signature" },
    });

    await expect(
      uploadMediaFile({
        file: sourceFile,
        destinationTab: "uploaded_images",
      })
    ).rejects.toThrow("Invalid signature");
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(uploadToSignedUrlMock).toHaveBeenCalledTimes(2);
  });

  it("maps non-json 413 prepare failures to a precise size-limit message", async () => {
    const sourceFile = new File(["raw-image"], "oversized-reference.png", {
      type: "image/png",
    });
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response("<html><body>413 payload too large</body></html>", {
        status: 413,
        headers: { "Content-Type": "text/html" },
      })
    );

    await expect(
      uploadMediaFile({
        file: sourceFile,
        destinationTab: "uploaded_images",
      })
    ).rejects.toThrow("Image file is too large. ShortPulse accepts images up to 25 MB.");
  });

  it("maps signed storage object-size failures to the canonical video size-limit message", async () => {
    const sourceFile = new File(["raw-video"], "oversized-reference.mp4", {
      type: "video/mp4",
    });
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        target: {
          intentId: "intent-1",
          bucketId: "media_upload_staging",
          storagePath: "user-1/upload-staging/uploaded_videos/oversized-reference.mp4",
          uploadToken: "token-1",
          mimeType: "video/mp4",
          name: "oversized-reference.mp4",
        },
      })
    );
    uploadToSignedUrlMock.mockResolvedValueOnce({
      data: null,
      error: { message: "The object exceeded the maximum allowed size" },
    });

    await expect(
      uploadMediaFile({
        file: sourceFile,
        destinationTab: "uploaded_videos",
      })
    ).rejects.toThrow("Video file is too large. ShortPulse accepts videos up to 100 MB.");
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    expect(uploadToSignedUrlMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces finalize route details when the staged media remains too large", async () => {
    const sourceFile = new File(["raw-image"], "oversized-reference.gif", {
      type: "image/gif",
    });
    fetchWithAuthMock
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            intentId: "intent-1",
            bucketId: "media_upload_staging",
            storagePath: "user-1/upload-staging/uploaded_images/oversized-reference.gif",
            uploadToken: "token-1",
            mimeType: "image/gif",
            name: "oversized-reference.gif",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: "Upload failed: file too large",
            details:
              "Animated images over 25 MB are not auto-resized yet. Export a smaller animated file or a static frame and try again.",
          },
          413
        )
      );

    await expect(
      uploadMediaFile({
        file: sourceFile,
        destinationTab: "uploaded_images",
      })
    ).rejects.toThrow(
      "Animated images over 25 MB are not auto-resized yet. Export a smaller animated file or a static frame and try again."
    );
  });
});
