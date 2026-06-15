import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/voices";
import { EXCLUDED_ELEVENLABS_VOICE_IDS } from "../../lib/server/elevenlabsVoiceExclusions";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const listSavedVoicesForUserWithDiagnosticsMock = vi.fn();
const listElevenLabsVoicesMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/userSavedVoices", () => ({
  listSavedVoicesForUserWithDiagnostics: (...args: unknown[]) =>
    listSavedVoicesForUserWithDiagnosticsMock(...args),
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
    listSavedVoicesForUserWithDiagnosticsMock.mockResolvedValue({
      voices: [],
      warning: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns merged live and saved voices when available", async () => {
    listSavedVoicesForUserWithDiagnosticsMock.mockResolvedValue({
      voices: [
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
      ],
      warning: null,
    });
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
    process.env.ELEVENLABS_API_KEY = "elevenlabs_test_key";

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

  it("does not expose unowned provider-created voices to other users", async () => {
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
    process.env.ELEVENLABS_API_KEY = "elevenlabs_test_key";

    const req = {
      method: "GET",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      source: "api" | "fallback";
      voices: Array<{ voiceId: string }>;
    };
    expect(payload.source).toBe("api");
    expect(payload.voices).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ voiceId: "voice-created-1" })])
    );
  });

  it("does not expose unowned provider voices when provider ownership metadata is missing", async () => {
    listElevenLabsVoicesMock.mockResolvedValue([
      {
        voiceId: "voice-unknown-1",
        name: "Unknown Provider Voice",
        previewUrl: "https://example.com/unknown.mp3",
        description: "Provider voice without a reliable shared catalog marker",
        isFallback: false,
        providerCategory: null,
        providerVoiceType: null,
      },
    ]);
    process.env.ELEVENLABS_API_KEY = "elevenlabs_test_key";

    const req = {
      method: "GET",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      source: "api" | "fallback";
      voices: Array<{ voiceId: string }>;
    };
    expect(payload.source).toBe("api");
    expect(payload.voices).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ voiceId: "voice-unknown-1" })])
    );
  });

  it("keeps the saved sample preview when a matching live provider voice has no preview", async () => {
    listSavedVoicesForUserWithDiagnosticsMock.mockResolvedValue({
      voices: [
        {
          voiceId: "voice-created-1",
          name: "Created Voice",
          previewUrl: "https://signed.example.com/created-sample.mp3",
          description: "Saved sample preview",
          provider: "elevenlabs",
          isFallback: false,
          createdAt: new Date().toISOString(),
          originKind: "provider-user-created",
          savedSource: "text-to-voice-create",
          providerDeleteEligible: true,
          sampleStoragePath: "user-1/voice-samples/voice-created-1/sample.mp3",
        },
      ],
      warning: null,
    });
    listElevenLabsVoicesMock.mockResolvedValue([
      {
        voiceId: "voice-created-1",
        name: "Created Voice",
        previewUrl: null,
        description: "Freshly generated provider voice",
        isFallback: false,
        providerCategory: "generated",
        providerVoiceType: "personal",
      },
    ]);
    process.env.ELEVENLABS_API_KEY = "elevenlabs_test_key";

    const req = {
      method: "GET",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      voices: Array<{ voiceId: string; previewUrl: string | null }>;
    };
    expect(payload.voices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          voiceId: "voice-created-1",
          previewUrl: "https://signed.example.com/created-sample.mp3",
        }),
      ])
    );
  });

  it("excludes configured provider voices from the voices catalog", async () => {
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
    process.env.ELEVENLABS_API_KEY = "elevenlabs_test_key";

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
    process.env.ELEVENLABS_API_KEY = "elevenlabs_test_key";
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

  it("keeps saved voices when live voice lookup fails", async () => {
    process.env.ELEVENLABS_API_KEY = "elevenlabs_test_key";
    listSavedVoicesForUserWithDiagnosticsMock.mockResolvedValue({
      voices: [
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
          sampleStoragePath: null,
        },
      ],
      warning: null,
    });
    listElevenLabsVoicesMock.mockRejectedValue(new Error("provider unavailable"));

    const req = {
      method: "GET",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      source: "api" | "fallback";
      voices: Array<{ voiceId: string; librarySection: string }>;
    };
    expect(payload.source).toBe("fallback");
    expect(payload.voices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          voiceId: "custom-1",
          librarySection: "my",
        }),
      ])
    );
    expect(payload.voices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          voiceId: "elevenlabs-default:darian",
          librarySection: "default",
        }),
      ])
    );
  });

  it("falls back when live voice lookup times out", async () => {
    vi.useFakeTimers();
    process.env.ELEVENLABS_API_KEY = "elevenlabs_test_key";
    listElevenLabsVoicesMock.mockImplementation(() => new Promise(() => undefined));

    const req = {
      method: "GET",
    };
    const res = createMockResponse();
    const pending = handler(req as never, res as never);

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      source: "api" | "fallback";
      voices: Array<{ voiceId: string; librarySection: string }>;
    };
    expect(payload.source).toBe("fallback");
    expect(payload.voices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          voiceId: "elevenlabs-default:darian",
          librarySection: "default",
        }),
      ])
    );
    expect(logApiRouteExceptionMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces an api warning when the saved custom voice ledger is temporarily unavailable", async () => {
    listSavedVoicesForUserWithDiagnosticsMock.mockResolvedValue({
      voices: [],
      warning: "Some saved custom voices may be temporarily unavailable. Please try again.",
    });
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
    process.env.ELEVENLABS_API_KEY = "elevenlabs_test_key";

    const req = {
      method: "GET",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const payload = res.json.mock.calls[0]?.[0] as {
      source: "api" | "fallback";
      warning?: string;
      voices: Array<{ voiceId: string }>;
    };
    expect(payload.source).toBe("api");
    expect(payload.warning).toBe(
      "Some saved custom voices may be temporarily unavailable. Please try again."
    );
    expect(payload.voices).toEqual(
      expect.arrayContaining([expect.objectContaining({ voiceId: "voice-live-1" })])
    );
  });
});
