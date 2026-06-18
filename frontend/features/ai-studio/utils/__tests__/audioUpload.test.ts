/**
 * Upload helper tests for AI Studio audio references.
 * Verifies local Lip Sync files can upload from the original File/Blob without refetching object URLs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const uploadToSignedUrlMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: () => ({
    storage: {
      from: () => ({
        uploadToSignedUrl: (...args: unknown[]) => uploadToSignedUrlMock(...args),
      }),
    },
  }),
}));

import { uploadAudioBlobToStorage } from "../audioUpload";

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("audioUpload", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
    uploadToSignedUrlMock.mockReset();
    uploadToSignedUrlMock.mockResolvedValue({ error: null });
  });

  it("uploads local audio from the original File object through the direct media upload path", async () => {
    const file = new File(["voice"], "voice-sample.mp3", { type: "audio/mpeg" });
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        target: {
          storagePath: "user-1/upload-staging/uploaded_videos/reference.mp3",
          uploadToken: "upload-token",
          mimeType: "audio/mpeg",
          name: "reference.mp3",
        },
      })
    );
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        file: {
          signedUrl: "https://signed.shortpulse.test/audio/reference.mp3",
          storage_path: "user-1/audio/reference.mp3",
          file_size: file.size,
          file_type: "audio",
        },
      })
    );

    const uploaded = await uploadAudioBlobToStorage(file, {
      sourceName: file.name,
      mimeType: file.type,
    });

    expect(uploaded).toEqual({
      url: "https://signed.shortpulse.test/audio/reference.mp3",
      path: "user-1/audio/reference.mp3",
      size: file.size,
      mimeType: "audio/mpeg",
    });
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/prepare-upload",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
    expect(JSON.parse(String(fetchWithAuthMock.mock.calls[0]?.[1]?.body))).toEqual({
      destinationTab: "uploaded_videos",
      sourceMimeType: "audio/mpeg",
      sourceName: expect.stringMatching(/^reference-audio-\d+-.*\.mp3$/),
    });
    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/upload-staging/uploaded_videos/reference.mp3",
      "upload-token",
      file,
      {
        contentType: "audio/mpeg",
        upsert: false,
      }
    );
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/finalize-upload",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          destinationTab: "uploaded_videos",
          sourceMimeType: "audio/mpeg",
          sourceName: "reference.mp3",
          sourceStoragePath: "user-1/upload-staging/uploaded_videos/reference.mp3",
        }),
      })
    );
  });
});
