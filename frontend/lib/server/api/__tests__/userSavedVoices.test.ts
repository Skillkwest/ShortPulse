import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedVoiceForUser,
  listSavedVoicesForUser,
  saveVoiceForUser,
} from "../userSavedVoices";

const getSupabaseAdminMock = vi.hoisted(() => vi.fn());

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

describe("userSavedVoices", () => {
  beforeEach(() => {
    getSupabaseAdminMock.mockReset();
  });

  it("lists normalized saved voices from user preferences", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        ai_studio_saved_voices: [
          {
            voiceId: "voice_b",
            name: "Beacon",
            previewUrl: "https://cdn.shortpulse.test/beacon.mp3",
            description: "Warm guide",
            createdAt: "2026-04-18T12:00:00.000Z",
          },
          {
            voiceId: "voice_a",
            name: "Atlas",
            previewUrl: null,
            description: "Grounded narrator",
            createdAt: "2026-04-19T12:00:00.000Z",
          },
        ],
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    getSupabaseAdminMock.mockReturnValue({ from });

    const voices = await listSavedVoicesForUser("user-123");

    expect(from).toHaveBeenCalledWith("user_preferences");
    expect(select).toHaveBeenCalledWith("ai_studio_saved_voices");
    expect(eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(voices).toEqual([
      {
        voiceId: "voice_a",
        name: "Atlas",
        previewUrl: null,
        description: "Grounded narrator",
        provider: "elevenlabs",
        isFallback: false,
        createdAt: "2026-04-19T12:00:00.000Z",
        originKind: "legacy-saved",
        savedSource: "legacy",
        providerDeleteEligible: false,
      },
      {
        voiceId: "voice_b",
        name: "Beacon",
        previewUrl: "https://cdn.shortpulse.test/beacon.mp3",
        description: "Warm guide",
        provider: "elevenlabs",
        isFallback: false,
        createdAt: "2026-04-18T12:00:00.000Z",
        originKind: "legacy-saved",
        savedSource: "legacy",
        providerDeleteEligible: false,
      },
    ]);
  });

  it("returns an empty list when the saved voices column is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42703", message: "column ai_studio_saved_voices does not exist" },
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    getSupabaseAdminMock.mockReturnValue({ from });

    await expect(listSavedVoicesForUser("user-123")).resolves.toEqual([]);
  });

  it("upserts a new saved voice for the authenticated user", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        ai_studio_saved_voices: [
          {
            voiceId: "voice_existing",
            name: "Existing",
            previewUrl: null,
            description: "Existing voice",
            createdAt: "2026-04-18T12:00:00.000Z",
          },
        ],
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((tableName: string) => {
      if (tableName !== "user_preferences") throw new Error(`Unexpected table ${tableName}`);
      return { select, upsert };
    });
    getSupabaseAdminMock.mockReturnValue({ from });

    const savedVoice = await saveVoiceForUser({
      userId: "user-123",
      voice: {
        voiceId: "voice_new",
        name: "  Lantern   ",
        previewUrl: "https://cdn.shortpulse.test/lantern.mp3",
        description: "Measured documentary narrator",
        originKind: "provider-user-created",
        savedSource: "voice-clone",
        providerDeleteEligible: true,
      },
    });

    expect(savedVoice).toMatchObject({
      voiceId: "voice_new",
      name: "Lantern",
      previewUrl: "https://cdn.shortpulse.test/lantern.mp3",
      description: "Measured documentary narrator",
      provider: "elevenlabs",
      isFallback: false,
      originKind: "provider-user-created",
      savedSource: "voice-clone",
      providerDeleteEligible: true,
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    const [payload, options] = upsert.mock.calls[0] ?? [];
    expect(options).toEqual({ onConflict: "user_id" });
    expect(payload.user_id).toBe("user-123");
    expect(payload.ai_studio_saved_voices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          voiceId: "voice_new",
          name: "Lantern",
          originKind: "provider-user-created",
          savedSource: "voice-clone",
          providerDeleteEligible: true,
        }),
        expect.objectContaining({
          voiceId: "voice_existing",
          name: "Existing",
        }),
      ])
    );
  });

  it("removes a saved voice for the authenticated user", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        ai_studio_saved_voices: [
          {
            voiceId: "voice_keep",
            name: "Keep",
            previewUrl: null,
            description: "Keep this voice",
            createdAt: "2026-04-18T12:00:00.000Z",
          },
          {
            voiceId: "voice_remove",
            name: "Remove",
            previewUrl: "https://cdn.shortpulse.test/remove.mp3",
            description: "Remove this voice",
            createdAt: "2026-04-19T12:00:00.000Z",
          },
        ],
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((tableName: string) => {
      if (tableName !== "user_preferences") throw new Error(`Unexpected table ${tableName}`);
      return { select, upsert };
    });
    getSupabaseAdminMock.mockReturnValue({ from });

    const deleted = await deleteSavedVoiceForUser({
      userId: "user-123",
      voiceId: "voice_remove",
    });

    expect(deleted).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
    const [payload, options] = upsert.mock.calls[0] ?? [];
    expect(options).toEqual({ onConflict: "user_id" });
    expect(payload.user_id).toBe("user-123");
    expect(payload.ai_studio_saved_voices).toEqual([
      expect.objectContaining({
        voiceId: "voice_keep",
        name: "Keep",
      }),
    ]);
  });
});
