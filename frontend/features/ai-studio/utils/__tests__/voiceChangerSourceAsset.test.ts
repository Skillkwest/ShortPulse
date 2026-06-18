import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
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

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: () => ensureSupabaseQueryClientMock(),
}));

import {
  uploadVoiceChangerSourceFile,
  uploadVoiceCloneSourceFile,
} from "../voiceChangerSourceAsset";

describe("voiceChangerSourceAsset upload helpers", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
    uploadToSignedUrlMock.mockReset();
    storageFromMock.mockClear();
    ensureSupabaseQueryClientMock.mockClear();
    uploadToSignedUrlMock.mockResolvedValue({ data: { path: "uploaded" }, error: null });
  });

  it.each([
    ["sample.mp3", "audio", "audio/mpeg"],
    ["sample.wav", "audio", "audio/wav"],
    ["sample.m4a", "audio", "audio/mp4"],
    ["sample.aac", "audio", "audio/aac"],
    ["sample.flac", "audio", "audio/flac"],
    ["sample.ogg", "audio", "audio/ogg"],
    ["sample.mp4", "video", "video/mp4"],
    ["sample.mov", "video", "video/quicktime"],
    ["sample.m4v", "video", "video/x-m4v"],
    ["sample.webm", "audio", "audio/webm"],
    ["sample.webm", "video", "video/webm"],
  ] as const)(
    "infers %s uploads as %s when the browser omits file.type",
    async (filename, kind, expectedMimeType) => {
      fetchWithAuthMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            target: {
              storagePath: `user-1/voice-changer/${kind === "video" ? "source-video" : "source-audio"}/${filename}`,
              uploadToken: "token-1",
              mimeType: expectedMimeType,
              name: filename,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            source: {
              storagePath: `user-1/voice-changer/${kind === "video" ? "source-video" : "source-audio"}/${filename}`,
              previewUrl: `https://signed.example/${filename}`,
              mimeType: expectedMimeType,
              name: filename,
              size: 4,
            },
          }),
        });

      const file = new File(["sample"], filename);
      await uploadVoiceChangerSourceFile({ file, kind });

      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/media/prepare-voice-changer-source-upload",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
      expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
        `user-1/voice-changer/${kind === "video" ? "source-video" : "source-audio"}/${filename}`,
        "token-1",
        file,
        expect.objectContaining({
          contentType: expectedMimeType,
          upsert: false,
        })
      );
      expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
        2,
        "/api/media/stage-voice-changer-source",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    }
  );

  it("normalizes audio/wave uploads to audio/wav before staging", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          target: {
            storagePath: "user-1/voice-changer/source-audio/sample.wav",
            uploadToken: "token-1",
            mimeType: "audio/wav",
            name: "sample.wav",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          source: {
            storagePath: "user-1/voice-changer/source-audio/sample.wav",
            previewUrl: "https://signed.example/sample.wav",
            mimeType: "audio/wav",
            name: "sample.wav",
            size: 4,
          },
        }),
      });

    const file = new File(["wav!"], "sample.wav", { type: "audio/wave" });
    await uploadVoiceChangerSourceFile({ file, kind: "audio" });

    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/voice-changer/source-audio/sample.wav",
      "token-1",
      file,
      expect.objectContaining({
        contentType: "audio/wav",
      })
    );
  });

  it("normalizes recorded audio/webm codec parameters before staging", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          target: {
            storagePath: "user-1/voice-changer/source-audio/recorded.webm",
            uploadToken: "token-1",
            mimeType: "audio/webm",
            name: "recorded.webm",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          source: {
            storagePath: "user-1/voice-changer/source-audio/recorded.webm",
            previewUrl: "https://signed.example/recorded.webm",
            mimeType: "audio/webm",
            name: "recorded.webm",
            size: 4,
          },
        }),
      });

    const file = new File(["webm"], "recorded.webm", { type: "audio/webm;codecs=opus" });
    await uploadVoiceChangerSourceFile({ file, kind: "audio" });

    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      1,
      "/api/media/prepare-voice-changer-source-upload",
      expect.objectContaining({
        body: JSON.stringify({
          sourceKind: "audio",
          sourceMimeType: "audio/webm",
          sourceName: "recorded.webm",
        }),
      })
    );
    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/voice-changer/source-audio/recorded.webm",
      "token-1",
      file,
      expect.objectContaining({
        contentType: "audio/webm",
      })
    );
    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      2,
      "/api/media/stage-voice-changer-source",
      expect.objectContaining({
        body: JSON.stringify({
          sourceKind: "audio",
          sourceMimeType: "audio/webm",
          sourceName: "recorded.webm",
          sourceStoragePath: "user-1/voice-changer/source-audio/recorded.webm",
        }),
      })
    );
  });

  it("returns the detected audio/webm mime type when a webm file stages through the video adapter", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          target: {
            storagePath: "user-1/voice-changer/source-video/sample.webm",
            uploadToken: "token-1",
            mimeType: "video/webm",
            name: "sample.webm",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          source: {
            storagePath: "user-1/voice-changer/source-video/sample.webm",
            previewUrl: "https://signed.example/sample.webm",
            mimeType: "audio/webm",
            name: "sample.webm",
            size: 4,
          },
        }),
      });

    const file = new File(["webm!"], "sample.webm");
    await expect(uploadVoiceChangerSourceFile({ file, kind: "video" })).resolves.toMatchObject({
      mimeType: "audio/webm",
    });

    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/voice-changer/source-video/sample.webm",
      "token-1",
      file,
      expect.objectContaining({
        contentType: "video/webm",
      })
    );
  });

  it("keeps voice clone uploads on the clone staging route", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        source: {
          storagePath: "user-1/voice-clone/source-audio/sample.wav",
          previewUrl: "https://signed.example/sample.wav",
          mimeType: "audio/wav",
          name: "sample.wav",
          size: 4,
        },
      }),
    });

    const file = new File(["wav!"], "sample.wav", { type: "audio/wave" });
    await expect(uploadVoiceCloneSourceFile({ file })).resolves.toMatchObject({
      storagePath: "user-1/voice-clone/source-audio/sample.wav",
      mimeType: "audio/wav",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/stage-voice-clone-source",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "audio/wav",
          "x-shortpulse-upload-filename": "sample.wav",
        }),
        body: file,
      })
    );
    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
    expect(uploadToSignedUrlMock).not.toHaveBeenCalled();
  });
});
