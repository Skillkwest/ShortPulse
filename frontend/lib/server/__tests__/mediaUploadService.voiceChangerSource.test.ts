// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdminMock = vi.hoisted(() => vi.fn());
const readStoredMediaBufferMock = vi.hoisted(() => vi.fn());
const normalizeVoiceChangerSourceVideoForProcessingMock = vi.hoisted(() => vi.fn());
const mediaComplianceAcceptanceMocks = vi.hoisted(() => ({
  getMediaComplianceAcceptanceStatusForUser: vi.fn(),
  isMediaComplianceUnavailableError: vi.fn(),
}));
const { MockMediaAudioExtractionInputError, MockVoiceChangerSourceVideoNormalizationError } =
  vi.hoisted(() => {
    class MediaAudioExtractionInputError extends Error {
      readonly statusCode: number;

      constructor(message: string, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
      }
    }

    class VoiceChangerSourceVideoNormalizationError extends Error {
      readonly status: number;
      readonly details?: string;

      constructor(status: number, message: string, details?: string) {
        super(message);
        this.status = status;
        this.details = details;
      }
    }

    return {
      MockMediaAudioExtractionInputError: MediaAudioExtractionInputError,
      MockVoiceChangerSourceVideoNormalizationError: VoiceChangerSourceVideoNormalizationError,
    };
  });

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../api/mediaComplianceAcceptance", () => ({
  getMediaComplianceAcceptanceStatusForUser:
    mediaComplianceAcceptanceMocks.getMediaComplianceAcceptanceStatusForUser,
  isMediaComplianceUnavailableError:
    mediaComplianceAcceptanceMocks.isMediaComplianceUnavailableError,
}));

vi.mock("../mediaAudioExtraction", () => ({
  MAX_VOICE_CHANGER_SOURCE_BYTES: 40 * 1024 * 1024,
  MediaAudioExtractionInputError: MockMediaAudioExtractionInputError,
  readStoredMediaBuffer: (...args: unknown[]) => readStoredMediaBufferMock(...args),
}));

vi.mock("../voiceChangerSourceVideoNormalization", () => ({
  VoiceChangerSourceVideoNormalizationError: MockVoiceChangerSourceVideoNormalizationError,
  normalizeVoiceChangerSourceVideoForProcessing: (...args: unknown[]) =>
    normalizeVoiceChangerSourceVideoForProcessingMock(...args),
}));

import {
  finalizeVoiceChangerSourceUploadForUser,
  stageVoiceChangerSourceBufferForUser,
} from "../mediaUploadService";

const buildMp4Signature = (): Buffer =>
  Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from("ftypmp42", "ascii")]);

describe("finalizeVoiceChangerSourceUploadForUser", () => {
  const uploadMock = vi.fn();
  const createSignedUrlMock = vi.fn();
  const removeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mediaComplianceAcceptanceMocks.getMediaComplianceAcceptanceStatusForUser.mockResolvedValue({
      accepted: true,
      acceptedAt: "2026-06-29T00:00:00.000Z",
    });
    mediaComplianceAcceptanceMocks.isMediaComplianceUnavailableError.mockReturnValue(false);
    uploadMock.mockResolvedValue({ error: null });
    createSignedUrlMock.mockImplementation(async (path: string) => ({
      data: { signedUrl: `https://signed.example/${path}` },
      error: null,
    }));
    removeMock.mockResolvedValue({ data: [], error: null });
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
          createSignedUrl: createSignedUrlMock,
          remove: removeMock,
        })),
      },
    });
    normalizeVoiceChangerSourceVideoForProcessingMock.mockResolvedValue({
      buffer: buildMp4Signature(),
      filename: "clip.mp4",
      mimeType: "video/mp4",
    });
  });

  it("normalizes staged Voice Changer videos above the processing ceiling before returning the source", async () => {
    const sourceBuffer = buildMp4Signature();
    readStoredMediaBufferMock.mockResolvedValueOnce({
      buffer: sourceBuffer,
      contentType: "video/mp4",
      size: 50 * 1024 * 1024,
    });

    const finalized = await finalizeVoiceChangerSourceUploadForUser({
      userId: "user-1",
      kind: "video",
      storagePath: "user-1/voice-changer/source-video/staged.mp4",
      filename: "clip.mp4",
      declaredMimeType: "video/mp4",
    });

    expect(readStoredMediaBufferMock).toHaveBeenCalledWith({
      storagePath: "user-1/voice-changer/source-video/staged.mp4",
      maxBytes: 100 * 1024 * 1024,
    });
    expect(normalizeVoiceChangerSourceVideoForProcessingMock).toHaveBeenCalledWith({
      buffer: sourceBuffer,
      filename: "clip.mp4",
      mimeType: "video/mp4",
      maxBytes: 40 * 1024 * 1024,
    });
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/voice-changer\/source-video\/.*clip\.mp4$/),
      buildMp4Signature(),
      expect.objectContaining({ contentType: "video/mp4", upsert: false })
    );
    expect(removeMock).toHaveBeenCalledWith(["user-1/voice-changer/source-video/staged.mp4"]);
    expect(finalized).toEqual({
      url: expect.stringMatching(
        /^https:\/\/signed\.example\/user-1\/voice-changer\/source-video\/.*clip\.mp4$/
      ),
      path: expect.stringMatching(/^user-1\/voice-changer\/source-video\/.*clip\.mp4$/),
      size: buildMp4Signature().length,
      mimeType: "video/mp4",
      name: "clip.mp4",
    });
  });

  it("preserves the current under-cap staged video path without unnecessary normalization", async () => {
    const sourceBuffer = buildMp4Signature();
    readStoredMediaBufferMock.mockResolvedValueOnce({
      buffer: sourceBuffer,
      contentType: "video/mp4",
      size: sourceBuffer.length,
    });

    const finalized = await finalizeVoiceChangerSourceUploadForUser({
      userId: "user-1",
      kind: "video",
      storagePath: "user-1/voice-changer/source-video/staged.mp4",
      filename: "clip.mp4",
      declaredMimeType: "video/mp4",
    });

    expect(readStoredMediaBufferMock).toHaveBeenCalledWith({
      storagePath: "user-1/voice-changer/source-video/staged.mp4",
      maxBytes: 100 * 1024 * 1024,
    });
    expect(normalizeVoiceChangerSourceVideoForProcessingMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      "user-1/voice-changer/source-video/staged.mp4",
      3600
    );
    expect(finalized).toEqual({
      url: "https://signed.example/user-1/voice-changer/source-video/staged.mp4",
      path: "user-1/voice-changer/source-video/staged.mp4",
      size: sourceBuffer.length,
      mimeType: "video/mp4",
      name: "clip.mp4",
    });
  });

  it("copies verified video bytes into canonical source-video storage without deleting the origin", async () => {
    const sourceBuffer = buildMp4Signature();

    const staged = await stageVoiceChangerSourceBufferForUser({
      userId: "user-1",
      kind: "video",
      buffer: sourceBuffer,
      filename: "reference.mp4",
      declaredMimeType: "video/mp4",
    });

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/voice-changer\/source-video\/.*reference\.mp4$/),
      sourceBuffer,
      expect.objectContaining({ contentType: "video/mp4", upsert: false })
    );
    expect(removeMock).not.toHaveBeenCalled();
    expect(staged).toMatchObject({
      path: expect.stringMatching(/^user-1\/voice-changer\/source-video\//),
      mimeType: "video/mp4",
      name: "reference.mp4",
      size: sourceBuffer.length,
    });
  });

  it("maps normalization failures to the existing service error shape", async () => {
    readStoredMediaBufferMock.mockResolvedValueOnce({
      buffer: buildMp4Signature(),
      contentType: "video/mp4",
      size: 50 * 1024 * 1024,
    });
    normalizeVoiceChangerSourceVideoForProcessingMock.mockRejectedValueOnce(
      new MockVoiceChangerSourceVideoNormalizationError(
        413,
        "Invalid request",
        "Voice changer source video could not be compressed under the processing limit. Use a shorter clip and try again."
      )
    );

    await expect(
      finalizeVoiceChangerSourceUploadForUser({
        userId: "user-1",
        kind: "video",
        storagePath: "user-1/voice-changer/source-video/staged.mp4",
        filename: "clip.mp4",
        declaredMimeType: "video/mp4",
      })
    ).rejects.toMatchObject({
      status: 413,
      message: "Invalid request",
      details:
        "Voice changer source video could not be compressed under the processing limit. Use a shorter clip and try again.",
    });
    expect(removeMock).toHaveBeenCalledWith(["user-1/voice-changer/source-video/staged.mp4"]);
  });
});
