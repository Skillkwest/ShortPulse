import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/voices";
import { EXCLUDED_ELEVENLABS_VOICE_IDS } from "../../lib/server/elevenlabsVoiceExclusions";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const listSavedVoicesForUserMock = vi.fn();
const listElevenLabsVoicesMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/userSavedVoices", () => ({
  listSavedVoicesForUser: (...args: unknown[]) => listSavedVoicesForUserMock(...args),
}));

vi.mock("../../lib/server/elevenlabs", () => ({
  listElevenLabsVoices: (...args: unknown[]) => listElevenLabsVoicesMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/elevenlabs/voices", () => {
  const excludedProviderVoiceId = EXCLUDED_ELEVENLABS_VOICE_IDS[0];

  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
  });

  it("returns merged live and saved voices when available", async () => {
    listSavedVoicesForUserMock.mockResolvedValue([
      {
        voiceId: "custom-1",
        name: "Custom Voice",
        previewUrl: "https://example.com/preview.mp3",
        description: "Saved by user",
        provider: "elevenlabs",
        isFallback: false,
        createdAt: new Date().toISOString(),
        originKind: "provider-saved",
        savedSource: "provider-save",
        providerDeleteEligible: false,
      },
    ]);
    listElevenLabsVoicesMock.mockResolvedValue([
      {
        voiceId: "voice-live-1",
        name: "Darian",
        previewUrl: null,
        description: "Warm, grounded storyteller",
        isFallback: false,
        providerCategory: "premade",
        providerVoiceType: "default",
      },
    ]);
    process.env.ELEVENLABS_API_KEY = "sk_live_mock";

    const req = {
      method: "GET",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0]?.[0] as {
      source: "api" | "fallback";
      voices: Array<{ voiceId: string; isFallback: boolean }>;
      warning?: string;
    };
    expect(payload.source).toBe("api");
    expect(payload.voices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          voiceId: "voice-live-1",
          isFallback: false,
          librarySection: "default",
          canRemoveFromLibrary: false,
          canDeleteFromProvider: false,
          destructiveAction: "none",
          destructiveActionDisabledReason: "Built-in catalog voices can't be deleted here.",
        }),
        expect.objectContaining({
          voiceId: "custom-1",
          isFallback: false,
          librarySection: "my",
          canRemoveFromLibrary: true,
          canDeleteFromProvider: false,
          destructiveAction: "remove",
          destructiveActionLabel: "Remove",
        }),
      ])
    );
    expect(payload.warning).toBeUndefined();
  });

  it("classifies provider-user-created voices into My Voices", async () => {
    listSavedVoicesForUserMock.mockResolvedValue([]);
    listElevenLabsVoicesMock.mockResolvedValue([
      {
        voiceId: "voice-created-1",
        name: "Created Voice",
        previewUrl: "https://example.com/created.mp3",
        description: "Freshly generated provider voice",
        isFallback: false,
        providerCategory: "generated",
        providerVoiceType: "personal",
      },
    ]);
    process.env.ELEVENLABS_API_KEY = "sk_live_mock";

    const req = {
      method: "GET",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      source: "api" | "fallback";
      voices: Array<{
        voiceId: string;
        librarySection: "default" | "my";
        originKind: string;
        canRemoveFromLibrary: boolean;
        canDeleteFromProvider: boolean;
        destructiveAction: "none" | "remove" | "delete";
      }>;
    };
    expect(payload.source).toBe("api");
    expect(payload.voices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          voiceId: "voice-created-1",
          librarySection: "my",
          originKind: "provider-user-created",
          canRemoveFromLibrary: false,
          canDeleteFromProvider: true,
          destructiveAction: "delete",
        }),
      ])
    );
  });

  it("excludes configured provider voices from the voices catalog", async () => {
    listSavedVoicesForUserMock.mockResolvedValue([]);
    listElevenLabsVoicesMock.mockResolvedValue([
      {
        voiceId: "voice-live-1",
        name: "Darian",
        previewUrl: null,
        description: "Warm, grounded storyteller",
        isFallback: false,
        providerCategory: "premade",
        providerVoiceType: "default",
      },
      {
        voiceId: excludedProviderVoiceId,
        name: "Excluded Provider Voice",
        previewUrl: "https://example.com/hidden-default.mp3",
        description: "Provider default voice that should stay hidden",
        isFallback: false,
        providerCategory: "premade",
        providerVoiceType: "default",
      },
    ]);
    process.env.ELEVENLABS_API_KEY = "sk_live_mock";

    const req = {
      method: "GET",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const payload = res.json.mock.calls[0]?.[0] as {
      source: "api" | "fallback";
      voices: Array<{ voiceId: string; name: string; librarySection: "default" | "my" }>;
    };

    expect(payload.source).toBe("api");
    expect(payload.voices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          voiceId: "voice-live-1",
          name: "Darian",
          librarySection: "default",
        }),
      ])
    );
    expect(payload.voices).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          voiceId: excludedProviderVoiceId,
          name: "Excluded Provider Voice",
          librarySection: "default",
        }),
      ])
    );
  });

  it("falls back to the default catalog when the API key is missing", async () => {
    process.env.ELEVENLABS_API_KEY = "";
    listSavedVoicesForUserMock.mockResolvedValue([]);
    listElevenLabsVoicesMock.mockRejectedValue(new Error("should not be called"));

    const req = {
      method: "GET",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      source: "api" | "fallback";
      voices: Array<{
        voiceId: string;
        isFallback: boolean;
        librarySection: string;
        destructiveAction: string;
      }>;
      warning: string;
    };
    expect(payload.source).toBe("fallback");
    expect(payload.warning).toBe("Showing default voices until live voices are configured.");
    expect(payload.voices.length).toBeGreaterThan(1);
    expect(payload.voices[0]?.isFallback).toBe(true);
    expect(payload.voices[0]?.librarySection).toBe("default");
    expect(payload.voices[0]?.destructiveAction).toBe("none");
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });

  it("falls back to defaults on live voice lookup failures", async () => {
    process.env.ELEVENLABS_API_KEY = "sk_live_mock";
    listSavedVoicesForUserMock.mockResolvedValue([]);
    listElevenLabsVoicesMock.mockRejectedValue(new Error("provider unavailable"));

    const req = {
      method: "GET",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      source: "api" | "fallback";
      warning: string;
      voices: Array<{
        voiceId: string;
        isFallback: boolean;
        librarySection: string;
        destructiveAction: string;
      }>;
    };
    expect(payload.source).toBe("fallback");
    expect(payload.warning).toBe("Showing default voices until live voices are configured.");
    expect(payload.voices[0]?.isFallback).toBe(true);
    expect(payload.voices[0]?.librarySection).toBe("default");
    expect(payload.voices[0]?.destructiveAction).toBe("none");
    expect(logApiRouteExceptionMock).toHaveBeenCalledTimes(1);
  });
});
