import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedVoiceForUser,
  listSavedVoicesForUser,
  saveVoiceForUser,
} from "../userSavedVoices";
import { EXCLUDED_ELEVENLABS_VOICE_IDS } from "../../elevenlabsVoiceExclusions";

const getSupabaseAdminMock = vi.hoisted(() => vi.fn());

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

type LegacySavedVoicesPayload = {
  ai_studio_saved_voices: Array<Record<string, unknown>>;
} | null;

type OwnedCustomVoiceRow = Record<string, unknown>;

const buildSupabaseAdminMock = ({
  legacyData = { ai_studio_saved_voices: [] },
  legacyError = null,
  ownedData = [],
  ownedError = null,
  deleteOwnedData = [],
  deleteOwnedError = null,
}: {
  legacyData?: LegacySavedVoicesPayload;
  legacyError?: { code?: string; message?: string } | null;
  ownedData?: OwnedCustomVoiceRow[] | null;
  ownedError?: { code?: string; message?: string } | null;
  deleteOwnedData?: Array<{ voice_id: string }> | null;
  deleteOwnedError?: { code?: string; message?: string } | null;
} = {}) => {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: legacyData,
    error: legacyError,
  });
  const legacyEq = vi.fn().mockReturnValue({ maybeSingle });
  const legacySelect = vi.fn().mockReturnValue({ eq: legacyEq });
  const legacyUpsert = vi.fn().mockResolvedValue({ error: null });

  const ownedOrder = vi.fn().mockResolvedValue({
    data: ownedData,
    error: ownedError,
  });
  const ownedProviderEq = vi.fn().mockReturnValue({ order: ownedOrder });
  const ownedUserEq = vi.fn().mockReturnValue({ eq: ownedProviderEq });
  const ownedSelect = vi.fn().mockReturnValue({ eq: ownedUserEq });
  const ownedUpsert = vi.fn().mockResolvedValue({ error: null });

  const ownedDeleteVoiceEq = vi.fn().mockResolvedValue({
    data: deleteOwnedData,
    error: deleteOwnedError,
  });
  const ownedDeleteProviderEq = vi.fn().mockReturnValue({ eq: ownedDeleteVoiceEq });
  const ownedDeleteUserEq = vi.fn().mockReturnValue({ eq: ownedDeleteProviderEq });
  const ownedDeleteSelect = vi.fn().mockReturnValue({ eq: ownedDeleteUserEq });
  const ownedDelete = vi.fn().mockReturnValue({ select: ownedDeleteSelect });

  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://signed.shortpulse.test/sample.mp3" },
    error: null,
  });
  const storageFrom = vi.fn().mockReturnValue({ createSignedUrl });

  const from = vi.fn((tableName: string) => {
    if (tableName === "user_preferences") {
      return {
        select: legacySelect,
        upsert: legacyUpsert,
      };
    }
    if (tableName === "user_owned_custom_voices") {
      return {
        select: ownedSelect,
        upsert: ownedUpsert,
        delete: ownedDelete,
      };
    }
    throw new Error(`Unexpected table ${tableName}`);
  });

  return {
    admin: { from, storage: { from: storageFrom } },
    calls: {
      from,
      legacySelect,
      legacyEq,
      maybeSingle,
      legacyUpsert,
      ownedSelect,
      ownedUserEq,
      ownedProviderEq,
      ownedOrder,
      ownedUpsert,
      ownedDelete,
      ownedDeleteSelect,
      ownedDeleteUserEq,
      ownedDeleteProviderEq,
      ownedDeleteVoiceEq,
      storageFrom,
      createSignedUrl,
    },
  };
};

describe("userSavedVoices", () => {
  const excludedProviderVoiceId = EXCLUDED_ELEVENLABS_VOICE_IDS[0];

  beforeEach(() => {
    getSupabaseAdminMock.mockReset();
  });

  it("lists merged owned custom voices and legacy saved voices, preferring the ownership ledger", async () => {
    const { admin, calls } = buildSupabaseAdminMock({
      legacyData: {
        ai_studio_saved_voices: [
          {
            voiceId: "voice_shared",
            name: "Shared Save",
            previewUrl: null,
            description: "Legacy saved voice",
            createdAt: "2026-04-18T12:00:00.000Z",
          },
          {
            voiceId: "voice_custom",
            name: "Old Custom Name",
            previewUrl: "https://expired.shortpulse.test/custom.mp3",
            description: "Legacy custom",
            createdAt: "2026-04-17T12:00:00.000Z",
            originKind: "provider-user-created",
            savedSource: "voice-clone",
            providerDeleteEligible: true,
            sampleStoragePath: "user-123/voice-samples/voice_custom/sample.mp3",
          },
        ],
      },
      ownedData: [
        {
          user_id: "user-123",
          provider: "elevenlabs",
          voice_id: "voice_custom",
          display_name: "Authoritative Custom",
          description: "Owned voice",
          preview_url: null,
          sample_storage_path: "user-123/voice-samples/voice_custom/sample.mp3",
          origin_kind: "provider-user-created",
          saved_source: "voice-clone",
          provider_delete_eligible: true,
          ownership_provenance: "voice_clone",
          ownership_confidence: "high",
          created_at: "2026-04-19T12:00:00.000Z",
          updated_at: "2026-04-19T12:00:00.000Z",
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const voices = await listSavedVoicesForUser("user-123");

    expect(calls.from).toHaveBeenCalledWith("user_preferences");
    expect(calls.from).toHaveBeenCalledWith("user_owned_custom_voices");
    expect(voices).toEqual([
      expect.objectContaining({
        voiceId: "voice_custom",
        name: "Authoritative Custom",
        originKind: "provider-user-created",
        savedSource: "voice-clone",
        providerDeleteEligible: true,
        previewUrl: "https://signed.shortpulse.test/sample.mp3",
      }),
      expect.objectContaining({
        voiceId: "voice_shared",
        name: "Shared Save",
        originKind: "legacy-saved",
        savedSource: "legacy",
      }),
    ]);
  });

  it("returns an empty list when both the legacy preference column and ownership table are unavailable", async () => {
    const { admin } = buildSupabaseAdminMock({
      legacyData: null,
      legacyError: { code: "42703", message: "column ai_studio_saved_voices does not exist" },
      ownedData: null,
      ownedError: { code: "42P01", message: "relation user_owned_custom_voices does not exist" },
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    await expect(listSavedVoicesForUser("user-123")).resolves.toEqual([]);
  });

  it("filters excluded provider voices from legacy preferences and persists the cleanup", async () => {
    const { admin, calls } = buildSupabaseAdminMock({
      legacyData: {
        ai_studio_saved_voices: [
          {
            voiceId: excludedProviderVoiceId,
            name: "Excluded Provider Voice",
            previewUrl: "https://cdn.shortpulse.test/excluded.mp3",
            description: "Should be removed",
            createdAt: "2026-04-20T12:00:00.000Z",
          },
          {
            voiceId: "voice_keep",
            name: "Keep",
            previewUrl: null,
            description: "Keep this voice",
            createdAt: "2026-04-19T12:00:00.000Z",
          },
        ],
      },
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const voices = await listSavedVoicesForUser("user-123");

    expect(voices).toEqual([
      expect.objectContaining({
        voiceId: "voice_keep",
        name: "Keep",
      }),
    ]);
    expect(calls.legacyUpsert).toHaveBeenCalledTimes(1);
    const [payload, options] = calls.legacyUpsert.mock.calls[0] ?? [];
    expect(options).toEqual({ onConflict: "user_id" });
    expect(payload.user_id).toBe("user-123");
    expect(payload.ai_studio_saved_voices).toEqual([
      expect.objectContaining({
        voiceId: "voice_keep",
        name: "Keep",
      }),
    ]);
  });

  it("upserts a new owned custom voice into the ownership table and legacy cache", async () => {
    const { admin, calls } = buildSupabaseAdminMock({
      legacyData: {
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
    });
    getSupabaseAdminMock.mockReturnValue(admin);

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
      originKind: "provider-user-created",
      savedSource: "voice-clone",
      providerDeleteEligible: true,
    });
    expect(calls.ownedUpsert).toHaveBeenCalledTimes(1);
    expect(calls.legacyUpsert).toHaveBeenCalledTimes(1);
    const [ownedPayload, ownedOptions] = calls.ownedUpsert.mock.calls[0] ?? [];
    expect(ownedOptions).toEqual({ onConflict: "user_id,provider,voice_id" });
    expect(ownedPayload.user_id).toBe("user-123");
    expect(ownedPayload.voice_id).toBe("voice_new");
    expect(ownedPayload.ownership_provenance).toBe("voice_clone");
    expect(ownedPayload.ownership_confidence).toBe("high");
  });

  it("refuses to save excluded provider voices", async () => {
    const { admin, calls } = buildSupabaseAdminMock();
    getSupabaseAdminMock.mockReturnValue(admin);

    const savedVoice = await saveVoiceForUser({
      userId: "user-123",
      voice: {
        voiceId: excludedProviderVoiceId,
        name: "Excluded Provider Voice",
        previewUrl: "https://cdn.shortpulse.test/excluded.mp3",
        description: "Should not persist",
        originKind: "provider-default",
        savedSource: "provider-save",
        providerDeleteEligible: false,
      },
    });

    expect(savedVoice).toBeNull();
    expect(calls.ownedUpsert).not.toHaveBeenCalled();
    expect(calls.legacyUpsert).not.toHaveBeenCalled();
  });

  it("removes a saved voice from both the ownership table and the legacy cache", async () => {
    const { admin, calls } = buildSupabaseAdminMock({
      legacyData: {
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
      deleteOwnedData: [{ voice_id: "voice_remove" }],
    });
    getSupabaseAdminMock.mockReturnValue(admin);

    const deleted = await deleteSavedVoiceForUser({
      userId: "user-123",
      voiceId: "voice_remove",
    });

    expect(deleted).toBe(true);
    expect(calls.ownedDelete).toHaveBeenCalledTimes(1);
    expect(calls.legacyUpsert).toHaveBeenCalledTimes(1);
    const [payload, options] = calls.legacyUpsert.mock.calls[0] ?? [];
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
