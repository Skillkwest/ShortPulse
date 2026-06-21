import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateAudioCompanionArtNowBestEffort,
  markAudioCompanionArtPendingBestEffort,
} from "../routePending";

const markAudioCompanionArtPendingMock = vi.fn();
const generateAudioCompanionArtForGenerationMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../processing", () => ({
  generateAudioCompanionArtForGeneration: (...args: unknown[]) =>
    generateAudioCompanionArtForGenerationMock(...args),
  markAudioCompanionArtPending: (...args: unknown[]) => markAudioCompanionArtPendingMock(...args),
}));

vi.mock("../../api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

describe("markAudioCompanionArtPendingBestEffort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks audio companion art pending", async () => {
    markAudioCompanionArtPendingMock.mockResolvedValueOnce(undefined);

    await markAudioCompanionArtPendingBestEffort({
      req: { method: "POST", url: "/api/elevenlabs/music" } as never,
      routeLabel: "elevenlabs-music",
      generationId: "gen-1",
      userId: "user-1",
      user: { id: "user-1", email: "u@example.com" },
    });

    expect(markAudioCompanionArtPendingMock).toHaveBeenCalledWith({
      generationId: "gen-1",
      userId: "user-1",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("logs companion-art queue failures without throwing", async () => {
    const error = new Error("projection queue unavailable");
    markAudioCompanionArtPendingMock.mockRejectedValueOnce(error);

    await expect(
      markAudioCompanionArtPendingBestEffort({
        req: { method: "POST", url: "/api/elevenlabs/music" } as never,
        routeLabel: "elevenlabs-music",
        generationId: "gen-1",
        userId: "user-1",
        user: { id: "user-1", email: "u@example.com" },
      })
    ).resolves.toBeUndefined();

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req: { method: "POST", url: "/api/elevenlabs/music" },
      error,
      routeLabel: "elevenlabs-music.companion-art",
      scope: "generation",
      user: { id: "user-1", email: "u@example.com" },
      metadata: {
        generation_id: "gen-1",
      },
    });
  });
});

describe("generateAudioCompanionArtNowBestEffort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns immediately generated audio companion art", async () => {
    generateAudioCompanionArtForGenerationMock.mockResolvedValueOnce({
      companionArtStatus: "ready",
      companionArtStoragePath: "user-1/generations/audio/gen-1/companion-art/cover.webp",
      companionArtUrl: "https://signed.example/cover.webp",
    });

    await expect(
      generateAudioCompanionArtNowBestEffort({
        req: { method: "POST", url: "/api/elevenlabs/text-to-speech" } as never,
        routeLabel: "elevenlabs-text-to-speech",
        generationId: "gen-1",
        userId: "user-1",
        user: { id: "user-1", email: "u@example.com" },
      })
    ).resolves.toEqual({
      companionArtStatus: "ready",
      companionArtStoragePath: "user-1/generations/audio/gen-1/companion-art/cover.webp",
      companionArtUrl: "https://signed.example/cover.webp",
    });

    expect(generateAudioCompanionArtForGenerationMock).toHaveBeenCalledWith({
      generationId: "gen-1",
      userId: "user-1",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("logs immediate companion-art generation failures without failing audio routes", async () => {
    const error = new Error("flux unavailable");
    generateAudioCompanionArtForGenerationMock.mockRejectedValueOnce(error);

    await expect(
      generateAudioCompanionArtNowBestEffort({
        req: { method: "POST", url: "/api/elevenlabs/text-to-speech" } as never,
        routeLabel: "elevenlabs-text-to-speech",
        generationId: "gen-1",
        userId: "user-1",
        user: { id: "user-1", email: "u@example.com" },
      })
    ).resolves.toBeNull();

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req: { method: "POST", url: "/api/elevenlabs/text-to-speech" },
      error,
      routeLabel: "elevenlabs-text-to-speech.companion-art.generate",
      scope: "generation",
      user: { id: "user-1", email: "u@example.com" },
      metadata: {
        generation_id: "gen-1",
      },
    });
  });
});
