import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/text-to-voice/design";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const designElevenLabsVoiceMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/elevenlabs", () => ({
  designElevenLabsVoice: (...args: unknown[]) => designElevenLabsVoiceMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/elevenlabs/text-to-voice/design", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
  });

  it("uses the catalog-backed default voice-design model id", async () => {
    designElevenLabsVoiceMock.mockResolvedValue({
      previews: [
        {
          generatedVoiceId: "voice-preview-1",
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
});
