import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/text-to-voice/design";
import { MAX_CUSTOM_VOICE_NAME_CHARACTERS } from "../../lib/customVoiceName";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const designElevenLabsVoiceMock = vi.fn();
const issueVoiceDesignPreviewTokenMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/elevenlabs", () => ({
  designElevenLabsVoice: (...args: unknown[]) => designElevenLabsVoiceMock(...args),
}));

vi.mock("../../lib/server/elevenlabsVoiceDesignTokens", () => ({
  issueVoiceDesignPreviewToken: (...args: unknown[]) => issueVoiceDesignPreviewTokenMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/elevenlabs/text-to-voice/design", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    issueVoiceDesignPreviewTokenMock.mockImplementation(
      ({ generatedVoiceId }: { generatedVoiceId: string }) => `token:${generatedVoiceId}`
    );
  });

  it("uses the catalog-backed default voice-design model id", async () => {
    designElevenLabsVoiceMock.mockResolvedValue({
      previews: [
        {
          generatedVoiceId: "voice-preview-1",
          previewToken: "token:voice-preview-1",
          audioBase64: "Zm9v",
          mediaType: "audio/mpeg",
          durationSecs: 12,
          language: "en",
        },
      ],
      text: "Preview sample",
    });

    const req = {
      method: "POST",
      body: {
        voiceName: "Night Host",
        voiceDescription: "Warm, intimate late-night radio host with crisp diction.",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(designElevenLabsVoiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "eleven_multilingual_ttv_v2",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      previews: [
        {
          generatedVoiceId: "voice-preview-1",
          previewToken: "token:voice-preview-1",
          audioBase64: "Zm9v",
          mediaType: "audio/mpeg",
          durationSecs: 12,
          language: "en",
        },
      ],
      previewText: "Preview sample",
      modelId: "eleven_multilingual_ttv_v2",
    });
  });

  it("rejects voice names that exceed the supported persisted length", async () => {
    const req = {
      method: "POST",
      body: {
        voiceName: "a".repeat(MAX_CUSTOM_VOICE_NAME_CHARACTERS + 1),
        voiceDescription: "Warm, intimate late-night radio host with crisp diction.",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(designElevenLabsVoiceMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: `voiceName must be between 1 and ${MAX_CUSTOM_VOICE_NAME_CHARACTERS} characters.`,
    });
  });

  it("rate limits repeated voice design preview requests for the same authenticated user", async () => {
    designElevenLabsVoiceMock.mockResolvedValue({
      previews: [
        {
          generatedVoiceId: "voice-preview-1",
          previewToken: "token:voice-preview-1",
          audioBase64: "Zm9v",
          mediaType: "audio/mpeg",
          durationSecs: 12,
          language: "en",
        },
      ],
      text: "Preview sample",
    });

    const buildReq = () => ({
      method: "POST",
      body: {
        voiceName: "Night Host",
        voiceDescription: "Warm, intimate late-night radio host with crisp diction.",
      },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const res = createMockResponse();
      await handler(buildReq() as never, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
    }

    const res = createMockResponse();
    await handler(buildReq() as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many requests",
      retryAfterSeconds: expect.any(Number),
    });
  });
});
