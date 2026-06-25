/**
 * Voice action API client tests.
 * Verifies the Sound -> Voice client preserves authenticated route contracts and errors.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cloneProviderVoice,
  createDesignedVoice,
  deleteProviderVoice,
  enhanceVoiceoverScript,
  requestVoiceDesignPreviews,
} from "../voiceActionsApiClient";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const jsonResponse = (payload: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(payload), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

describe("voiceActionsApiClient", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
  });

  it("requests voice design previews with the protected route contract", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        previews: [
          {
            generatedVoiceId: "generated-voice-1",
            previewToken: "token-1",
            audioBase64: "ZmFrZQ==",
            mediaType: "audio/mpeg",
            durationSecs: 2.5,
            language: "en",
          },
        ],
        previewText: "Preview text",
      })
    );

    await expect(
      requestVoiceDesignPreviews({
        voiceName: "Lantern",
        voiceDescription: "Warm documentary narrator.",
      })
    ).resolves.toMatchObject({
      previews: [expect.objectContaining({ generatedVoiceId: "generated-voice-1" })],
      previewText: "Preview text",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/elevenlabs/text-to-voice/design", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voiceName: "Lantern",
        voiceDescription: "Warm documentary narrator.",
      }),
      shortpulseLogScope: "generation",
    });
  });

  it("creates a designed voice with selected and rejected preview tokens", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        voice: {
          voiceId: "voice-created-1",
          name: "Lantern",
        },
      })
    );

    await createDesignedVoice({
      voiceName: "Lantern",
      voiceDescription: "Warm documentary narrator.",
      generatedVoiceId: "generated-voice-2",
      generatedVoiceToken: "token-2",
      playedNotSelectedVoiceIds: ["generated-voice-1"],
      playedNotSelectedVoiceTokens: ["token-1"],
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/elevenlabs/text-to-voice/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voiceName: "Lantern",
        voiceDescription: "Warm documentary narrator.",
        generatedVoiceId: "generated-voice-2",
        generatedVoiceToken: "token-2",
        playedNotSelectedVoiceIds: ["generated-voice-1"],
        playedNotSelectedVoiceTokens: ["token-1"],
      }),
      shortpulseLogScope: "generation",
    });
  });

  it("clones a provider voice from a staged storage path", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        voice: {
          voiceId: "voice-cloned-1",
          name: "Clone",
        },
      })
    );

    await cloneProviderVoice({
      voiceName: "Clone",
      sourceStoragePath: "user-1/voice-clone/source-audio/sample.mp3",
      sourceName: "sample.mp3",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/elevenlabs/voices/clone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voiceName: "Clone",
        sourceStoragePath: "user-1/voice-clone/source-audio/sample.mp3",
        sourceName: "sample.mp3",
        removeBackgroundNoise: true,
      }),
      shortpulseLogScope: "generation",
    });
  });

  it("deletes voices through the encoded server-authoritative route", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    await deleteProviderVoice("voice/id with space");

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/elevenlabs/voices/voice%2Fid%20with%20space",
      {
        method: "DELETE",
        shortpulseLogScope: "generation",
      }
    );
  });

  it("enhances voiceover script text without generation error logging", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({ enhancedScript: "[calm] Launch narration." })
    );

    await expect(enhanceVoiceoverScript("Launch narration.")).resolves.toBe(
      "[calm] Launch narration."
    );

    expect(fetchWithAuthMock).toHaveBeenCalledWith("/api/ai/voiceover-enhance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ script: "Launch narration." }),
      shortpulseLogScope: "generation",
      shortpulseSkipErrorLogging: true,
    });
  });

  it("uses provider details when a voice action route fails", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({ error: "Generic failure", details: "Try again shortly." }, { status: 503 })
    );

    await expect(
      requestVoiceDesignPreviews({
        voiceName: "Lantern",
        voiceDescription: "Warm documentary narrator.",
      })
    ).rejects.toThrow("Try again shortly.");
  });

  it("rejects invalid enhance responses with the existing fallback message", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(jsonResponse({ enhancedScript: "" }));

    await expect(enhanceVoiceoverScript("Launch narration.")).rejects.toThrow(
      "Unable to enhance voiceover."
    );
  });
});
