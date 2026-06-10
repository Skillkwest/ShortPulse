/**
 * Upload helper tests for AI Studio audio references.
 * Verifies local Lip Sync files can upload from the original File/Blob without refetching object URLs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
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
  });

  it("uploads local audio from the original File object", async () => {
    const file = new File(["voice"], "voice-sample.mp3", { type: "audio/mpeg" });
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
      "/api/media/upload",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "audio/mpeg",
          "x-shortpulse-upload-filename": expect.stringMatching(/^reference-audio-\d+-.*\.mp3$/),
          "x-shortpulse-upload-destination-tab": "uploaded_videos",
        }),
        body: file,
      })
    );
  });
});
