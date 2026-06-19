import { beforeEach, describe, expect, it, vi } from "vitest";
import { markAudioCompanionArtPendingBestEffort } from "../routePending";

const markAudioCompanionArtPendingMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../processing", () => ({
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
