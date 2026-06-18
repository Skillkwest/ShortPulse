import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/elevenlabs/voices/[voiceId]";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const listSavedVoicesForUserMock = vi.fn();
const deleteSavedVoiceForUserMock = vi.fn();
const listElevenLabsVoicesMock = vi.fn();
const deleteElevenLabsVoiceMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/userSavedVoices", () => ({
  listSavedVoicesForUser: (...args: unknown[]) => listSavedVoicesForUserMock(...args),
  deleteSavedVoiceForUser: (...args: unknown[]) => deleteSavedVoiceForUserMock(...args),
}));

vi.mock("../../lib/server/elevenlabs", () => ({
  listElevenLabsVoices: (...args: unknown[]) => listElevenLabsVoicesMock(...args),
  deleteElevenLabsVoice: (...args: unknown[]) => deleteElevenLabsVoiceMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("DELETE /api/elevenlabs/voices/[voiceId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    process.env.ELEVENLABS_API_KEY = "elevenlabs_test_key";
  });

  it("logs auth verifier failures before voice lookup or deletion work", async () => {
    const authError = new Error("auth verifier exploded");
    requireApiUserMock.mockRejectedValueOnce(authError);
    const req = {
      method: "DELETE",
      query: { voiceId: "voice-clone-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: authError,
        routeLabel: "elevenlabs-voice-delete.auth",
        scope: "generation",
      })
    );
    expect(listSavedVoicesForUserMock).not.toHaveBeenCalled();
    expect(listElevenLabsVoicesMock).not.toHaveBeenCalled();
    expect(deleteElevenLabsVoiceMock).not.toHaveBeenCalled();
    expect(deleteSavedVoiceForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to delete voice",
      details: "Unable to delete voice.",
    });
  });

  it("removes a saved non-provider-owned voice from ShortPulse only", async () => {
    listSavedVoicesForUserMock.mockResolvedValue([
      {
        voiceId: "saved-library-1",
        name: "Community Voice",
        previewUrl: null,
        description: "Saved library voice",
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
        voiceId: "saved-library-1",
        name: "Community Voice",
        previewUrl: null,
        description: "Saved library voice",
        isFallback: false,
        providerCategory: "professional",
        providerVoiceType: "community",
      },
    ]);
    deleteSavedVoiceForUserMock.mockResolvedValue(true);

    const req = {
      method: "DELETE",
      query: { voiceId: "saved-library-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(deleteElevenLabsVoiceMock).not.toHaveBeenCalled();
    expect(deleteSavedVoiceForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      voiceId: "saved-library-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: "ok",
      voiceId: "saved-library-1",
      action: "remove",
    });
  });

  it("rejects protected provider catalog voices", async () => {
    listSavedVoicesForUserMock.mockResolvedValue([]);
    listElevenLabsVoicesMock.mockResolvedValue([
      {
        voiceId: "voice-premade-1",
        name: "Lily",
        previewUrl: null,
        description: "Premade voice",
        isFallback: false,
        providerCategory: "premade",
        providerVoiceType: "default",
      },
    ]);

    const req = {
      method: "DELETE",
      query: { voiceId: "voice-premade-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(deleteElevenLabsVoiceMock).not.toHaveBeenCalled();
    expect(deleteSavedVoiceForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Voice is protected",
      details: "Built-in catalog voices can't be deleted here.",
    });
  });

  it("deletes a provider-owned user-created voice upstream and removes local saved state", async () => {
    listSavedVoicesForUserMock.mockResolvedValue([
      {
        voiceId: "voice-clone-1",
        name: "Cloned Voice",
        previewUrl: null,
        description: "User clone",
        provider: "elevenlabs",
        isFallback: false,
        createdAt: new Date().toISOString(),
        originKind: "provider-user-created",
        savedSource: "voice-clone",
        providerDeleteEligible: true,
      },
    ]);
    listElevenLabsVoicesMock.mockResolvedValue([
      {
        voiceId: "voice-clone-1",
        name: "Cloned Voice",
        previewUrl: null,
        description: "User clone",
        isFallback: false,
        providerCategory: "cloned",
        providerVoiceType: "personal",
      },
    ]);
    deleteSavedVoiceForUserMock.mockResolvedValue(true);
    deleteElevenLabsVoiceMock.mockResolvedValue(undefined);

    const req = {
      method: "DELETE",
      query: { voiceId: "voice-clone-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(deleteElevenLabsVoiceMock).toHaveBeenCalledWith("voice-clone-1");
    expect(deleteSavedVoiceForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      voiceId: "voice-clone-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: "ok",
      voiceId: "voice-clone-1",
      action: "delete",
    });
  });

  it("preserves provider retry status when upstream voice deletion is rate limited", async () => {
    listSavedVoicesForUserMock.mockResolvedValue([
      {
        voiceId: "voice-clone-1",
        name: "Cloned Voice",
        previewUrl: null,
        description: "User clone",
        provider: "elevenlabs",
        isFallback: false,
        createdAt: new Date().toISOString(),
        originKind: "provider-user-created",
        savedSource: "voice-clone",
        providerDeleteEligible: true,
      },
    ]);
    listElevenLabsVoicesMock.mockResolvedValue([
      {
        voiceId: "voice-clone-1",
        name: "Cloned Voice",
        previewUrl: null,
        description: "User clone",
        isFallback: false,
        providerCategory: "cloned",
        providerVoiceType: "personal",
      },
    ]);
    deleteElevenLabsVoiceMock.mockRejectedValueOnce(
      Object.assign(new Error("too_many_concurrent_requests: req_sensitive"), {
        status: 429,
        code: "too_many_concurrent_requests",
        retryAfterSeconds: 12,
      })
    );

    const req = {
      method: "DELETE",
      query: { voiceId: "voice-clone-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(deleteSavedVoiceForUserMock).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "12");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to delete voice",
      details:
        "The audio provider is at its concurrency limit right now. Please retry in 12 seconds.",
      code: "too_many_concurrent_requests",
      retryAfterSeconds: 12,
    });
  });

  it("does not allow deleting another user's provider-created voice", async () => {
    listSavedVoicesForUserMock.mockResolvedValue([]);
    listElevenLabsVoicesMock.mockResolvedValue([
      {
        voiceId: "foreign-clone-1",
        name: "Foreign Clone",
        previewUrl: null,
        description: "Belongs to somebody else",
        isFallback: false,
        providerCategory: "cloned",
        providerVoiceType: "personal",
      },
    ]);

    const req = {
      method: "DELETE",
      query: { voiceId: "foreign-clone-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(deleteElevenLabsVoiceMock).not.toHaveBeenCalled();
    expect(deleteSavedVoiceForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Voice not found",
      details: "The selected voice could not be found.",
    });
  });

  it("does not allow deleting unowned provider voices with missing ownership metadata", async () => {
    listSavedVoicesForUserMock.mockResolvedValue([]);
    listElevenLabsVoicesMock.mockResolvedValue([
      {
        voiceId: "unknown-provider-1",
        name: "Unknown Provider Voice",
        previewUrl: null,
        description: "Provider voice without reliable shared catalog metadata",
        isFallback: false,
        providerCategory: null,
        providerVoiceType: null,
      },
    ]);

    const req = {
      method: "DELETE",
      query: { voiceId: "unknown-provider-1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(deleteElevenLabsVoiceMock).not.toHaveBeenCalled();
    expect(deleteSavedVoiceForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Voice not found",
      details: "The selected voice could not be found.",
    });
  });
});
