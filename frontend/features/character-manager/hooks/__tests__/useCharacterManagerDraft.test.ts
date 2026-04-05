/**
 * Characterizes `useCharacterManagerDraft` preset orchestration behavior.
 * Locks bootstrap selection, asset persistence, preview stability, and preset fallback flows before B3-02 controller extraction.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultCharacterSheetPresetDescriptions,
  createDefaultCharacterSheetPresetLabels,
  createDefaultCharacterSheetPresetState,
  createEmptyCharacterSheetAssignments,
  createEmptyCharacterSlotMap,
} from "../../constants";
import { useCharacterManagerDraft } from "../useCharacterManagerDraft";
import { readSupabaseUserId } from "../../../../lib/supabaseClient";
import {
  clearCharacterManagerProfileImage,
  deleteCharacterManagerCharacterSheetPreset,
  listCharacterManagerCharacters,
  loadOrCreateCharacterManagerDraft,
  saveCharacterManagerActiveCharacterSheetPreset,
  saveCharacterManagerProfileImage,
  saveCharacterManagerSlot,
} from "../../logic/characterManagerPersistence";
import { publishCharacterListChanged } from "../../logic/characterListSyncEvents";
import {
  persistSelectedCharacterId,
  readPersistedSelectedCharacterId,
} from "../../logic/selectedCharacterPersistence";
import { validateCharacterReferenceFile } from "../../logic/referenceValidation";

vi.mock("../../../../lib/supabaseClient", async () => {
  const { createSupabaseClientModuleMock } =
    await import("../../../../tests/support/supabaseClientMock");
  return createSupabaseClientModuleMock();
});

vi.mock("../../logic/characterManagerPersistence", () => ({
  clearCharacterManagerProfileImage: vi.fn(),
  clearCharacterManagerSlot: vi.fn(),
  createCharacterManagerDraft: vi.fn(),
  deleteCharacterManagerDraft: vi.fn(),
  deleteCharacterManagerCharacterSheetPreset: vi.fn(),
  listCharacterManagerCharacters: vi.fn(),
  loadCharacterManagerDraftByCharacterId: vi.fn(),
  loadOrCreateCharacterManagerDraft: vi.fn(),
  saveCharacterManagerActiveCharacterSheetPreset: vi.fn(),
  saveCharacterManagerCharacterSheetAssignments: vi.fn(),
  saveCharacterManagerCharacterSheetPresetAsset: vi.fn(),
  saveCharacterManagerCharacterSheetPresetAssignments: vi.fn(),
  saveCharacterManagerCharacterSheetPresetTabDescription: vi.fn(),
  saveCharacterManagerCharacterSheetPresetTabLabel: vi.fn(),
  saveCharacterManagerCharacterSheetPresetTabOrder: vi.fn(),
  saveCharacterManagerProfileImage: vi.fn(),
  saveCharacterManagerProfileImageAdjustments: vi.fn(),
  saveCharacterManagerSlot: vi.fn(),
  updateCharacterManagerName: vi.fn(),
}));

vi.mock("../../logic/characterListSyncEvents", () => ({
  publishCharacterListChanged: vi.fn(),
}));

vi.mock("../../logic/selectedCharacterPersistence", () => ({
  persistSelectedCharacterId: vi.fn(),
  readPersistedSelectedCharacterId: vi.fn(),
}));

vi.mock("../../logic/referenceValidation", () => ({
  validateCharacterReferenceFile: vi.fn(),
}));

const readSupabaseUserIdMock = vi.mocked(readSupabaseUserId);
const loadOrCreateCharacterManagerDraftMock = vi.mocked(loadOrCreateCharacterManagerDraft);
const listCharacterManagerCharactersMock = vi.mocked(listCharacterManagerCharacters);
const saveCharacterManagerActiveCharacterSheetPresetMock = vi.mocked(
  saveCharacterManagerActiveCharacterSheetPreset
);
const saveCharacterManagerProfileImageMock = vi.mocked(saveCharacterManagerProfileImage);
const clearCharacterManagerProfileImageMock = vi.mocked(clearCharacterManagerProfileImage);
const saveCharacterManagerSlotMock = vi.mocked(saveCharacterManagerSlot);
const deleteCharacterManagerCharacterSheetPresetMock = vi.mocked(
  deleteCharacterManagerCharacterSheetPreset
);
const publishCharacterListChangedMock = vi.mocked(publishCharacterListChanged);
const persistSelectedCharacterIdMock = vi.mocked(persistSelectedCharacterId);
const readPersistedSelectedCharacterIdMock = vi.mocked(readPersistedSelectedCharacterId);
const validateCharacterReferenceFileMock = vi.mocked(validateCharacterReferenceFile);

type DraftSnapshot = Awaited<ReturnType<typeof loadOrCreateCharacterManagerDraft>>;

const createPresetMedia = (id: string, previewUrl: string | null) => ({
  mediaFileId: `media-${id}`,
  storagePath: `user/presets/${id}.png`,
  previewUrl,
});

const createDraftSnapshot = (): DraftSnapshot => {
  const presetState = createDefaultCharacterSheetPresetState();
  const descriptions = createDefaultCharacterSheetPresetDescriptions();
  const labels = createDefaultCharacterSheetPresetLabels();
  const presets = {
    ...presetState.presets,
    "1": {
      ...presetState.presets["1"],
      portrait: createPresetMedia("preset-1", "https://signed.example/preset-1.png"),
    },
    "2": {
      ...presetState.presets["2"],
      portrait: createPresetMedia("preset-2", "https://signed.example/preset-2.png"),
    },
    "3": {
      ...presetState.presets["3"],
      portrait: createPresetMedia("preset-3", "https://signed.example/preset-3.png"),
    },
  };
  descriptions["1"] = "Primary description";
  descriptions["2"] = "Alternate description";
  descriptions["3"] = "Third description";
  labels["1"] = "Main";
  labels["2"] = "Alt";
  labels["3"] = "Spare";

  return {
    userId: "user-1",
    characterId: "char-1",
    characterSheetId: "sheet-1",
    characterName: "Hero",
    characterDescription: descriptions["1"],
    characterSheetAssignments: createEmptyCharacterSheetAssignments(),
    activeCharacterSheetPresetId: "1",
    characterSheetPresets: presets,
    visibleCharacterSheetPresetIds: ["1", "2", "3"],
    characterSheetPresetLabels: labels,
    characterSheetPresetDescriptions: descriptions,
    characterSheetPresetAssignments: presets["1"],
    profileImageUrl: null,
    profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
    slots: createEmptyCharacterSlotMap(),
  } as DraftSnapshot;
};

const configureBootstrap = (snapshot: DraftSnapshot) => {
  readSupabaseUserIdMock.mockResolvedValue(snapshot.userId);
  readPersistedSelectedCharacterIdMock.mockReturnValue(null);
  loadOrCreateCharacterManagerDraftMock.mockResolvedValue(snapshot);
  listCharacterManagerCharactersMock.mockResolvedValue([
    {
      characterId: snapshot.characterId,
      characterName: snapshot.characterName,
      profileImageUrl: snapshot.profileImageUrl,
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
  ] as never);
};

describe("useCharacterManagerDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
  });

  it("uses the user-scoped persisted selection during bootstrap", async () => {
    const snapshot = createDraftSnapshot();
    readSupabaseUserIdMock.mockResolvedValue(snapshot.userId);
    readPersistedSelectedCharacterIdMock.mockReturnValue("char-scoped");
    loadOrCreateCharacterManagerDraftMock.mockResolvedValue(snapshot);
    listCharacterManagerCharactersMock.mockResolvedValue([
      {
        characterId: snapshot.characterId,
        characterName: snapshot.characterName,
        profileImageUrl: snapshot.profileImageUrl,
        updatedAt: "2026-03-17T00:00:00.000Z",
      },
    ] as never);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBe("char-1");
    });

    expect(readPersistedSelectedCharacterIdMock).toHaveBeenCalledWith({ userId: "user-1" });
    expect(loadOrCreateCharacterManagerDraftMock).toHaveBeenCalledWith("char-scoped");
    expect(persistSelectedCharacterIdMock).toHaveBeenCalledWith("char-1", { userId: "user-1" });
  });

  it("keeps local preset preview urls stable when switching the active preset", async () => {
    const snapshot = createDraftSnapshot();
    configureBootstrap(snapshot);
    saveCharacterManagerActiveCharacterSheetPresetMock.mockResolvedValue({
      activePresetId: "2",
      tabOrder: ["1", "2", "3"],
      tabLabels: snapshot.characterSheetPresetLabels,
      tabDescriptions: snapshot.characterSheetPresetDescriptions,
      presets: {
        ...snapshot.characterSheetPresets,
        "2": {
          ...snapshot.characterSheetPresets["2"],
          portrait: createPresetMedia("preset-2", null),
        },
      },
    } as never);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.activeCharacterSheetPresetId).toBe("1");
    });

    await act(async () => {
      const ok = await result.current.setActiveCharacterSheetPreset("2");
      expect(ok).toBe(true);
    });

    expect(saveCharacterManagerActiveCharacterSheetPresetMock).toHaveBeenCalledWith({
      characterId: "char-1",
      presetId: "2",
    });
    expect(result.current.activeCharacterSheetPresetId).toBe("2");
    expect(result.current.characterDescription).toBe("Alternate description");
    expect(result.current.characterSheetPresetAssignments.portrait?.previewUrl).toBe(
      "https://signed.example/preset-2.png"
    );
    expect(persistSelectedCharacterIdMock).toHaveBeenCalledWith("char-1", { userId: "user-1" });
  });

  it("uploads a profile image and refreshes the character rail", async () => {
    const snapshot = createDraftSnapshot();
    readSupabaseUserIdMock.mockResolvedValue(snapshot.userId);
    readPersistedSelectedCharacterIdMock.mockReturnValue(null);
    loadOrCreateCharacterManagerDraftMock.mockResolvedValue(snapshot);
    listCharacterManagerCharactersMock
      .mockResolvedValueOnce([
        {
          characterId: snapshot.characterId,
          characterName: snapshot.characterName,
          profileImageUrl: snapshot.profileImageUrl,
          updatedAt: "2026-03-17T00:00:00.000Z",
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          characterId: snapshot.characterId,
          characterName: snapshot.characterName,
          profileImageUrl: "https://signed.example/profile.png",
          updatedAt: "2026-03-17T00:00:01.000Z",
        },
      ] as never);
    saveCharacterManagerProfileImageMock.mockResolvedValue(
      "https://signed.example/profile.png" as never
    );

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.profileImageUrl).toBeNull();
    });

    const file = new File(["profile"], "profile.png", { type: "image/png" });
    await act(async () => {
      await result.current.setProfileImageFile(file);
    });

    await waitFor(() => {
      expect(result.current.profileImageUrl).toBe("https://signed.example/profile.png");
      expect(result.current.characters[0]?.profileImageUrl).toBe(
        "https://signed.example/profile.png"
      );
    });

    expect(saveCharacterManagerProfileImageMock).toHaveBeenCalledWith({
      characterId: "char-1",
      file,
    });
    expect(publishCharacterListChangedMock).toHaveBeenCalledWith({
      userId: "user-1",
      reason: "profile_image",
    });
    expect(clearCharacterManagerProfileImageMock).not.toHaveBeenCalled();
  });

  it("validates and saves a slot image while clearing busy state", async () => {
    const snapshot = createDraftSnapshot();
    configureBootstrap(snapshot);
    const file = new File(["slot"], "front-full.png", { type: "image/png" });
    const validationNotes = {
      validatorVersion: 1,
      mimeType: file.type,
      width: 1024,
      height: 1536,
      aspectRatio: 0.6667,
      sha256: "abc123",
      hardErrors: [],
      warnings: [],
      evaluatedAt: "2026-03-17T00:00:00.000Z",
    };
    validateCharacterReferenceFileMock.mockResolvedValue({
      status: "pass",
      notes: validationNotes,
    } as never);
    saveCharacterManagerSlotMock.mockResolvedValue({
      mediaFileId: "slot-1",
      storagePath: "user-1/char-1/front-full.png",
      validationStatus: "pass",
      validationNotes,
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: "https://signed.example/front-full.png",
      updatedAt: "2026-03-17T00:00:01.000Z",
    } as never);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.isSlotBusy("front_full")).toBe(false);
    });

    await act(async () => {
      const ok = await result.current.setSlotFile("front_full", file);
      expect(ok).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.slots.front_full?.previewUrl).toBe(
        "https://signed.example/front-full.png"
      );
      expect(result.current.isSlotBusy("front_full")).toBe(false);
    });

    expect(validateCharacterReferenceFileMock).toHaveBeenCalledWith({
      slotKey: "front_full",
      file,
      existingSlots: expect.any(Object),
    });
    expect(saveCharacterManagerSlotMock).toHaveBeenCalledWith({
      characterId: "char-1",
      characterSheetId: "sheet-1",
      slotKey: "front_full",
      file,
      validationStatus: "pass",
      validationNotes,
    });
  });

  it("uses nearest-left fallback when deleting the active preset tab", async () => {
    const snapshot = {
      ...createDraftSnapshot(),
      activeCharacterSheetPresetId: "2",
      characterDescription: "Alternate description",
      characterSheetPresetAssignments: createDraftSnapshot().characterSheetPresets["2"],
    } as DraftSnapshot;
    configureBootstrap(snapshot);
    deleteCharacterManagerCharacterSheetPresetMock.mockResolvedValue({
      activePresetId: "1",
      tabOrder: ["1", "3"],
      tabLabels: snapshot.characterSheetPresetLabels,
      tabDescriptions: {
        ...snapshot.characterSheetPresetDescriptions,
        "2": "",
      },
      presets: {
        ...snapshot.characterSheetPresets,
        "2": createDefaultCharacterSheetPresetState().presets["2"],
      },
    } as never);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.activeCharacterSheetPresetId).toBe("2");
    });

    await act(async () => {
      const ok = await result.current.deleteCharacterSheetPreset("2");
      expect(ok).toBe(true);
    });

    expect(deleteCharacterManagerCharacterSheetPresetMock).toHaveBeenCalledWith({
      characterId: "char-1",
      presetId: "2",
      nextTabOrder: ["1", "3"],
      nextActivePresetId: "1",
    });
    expect(result.current.activeCharacterSheetPresetId).toBe("1");
    expect(result.current.visibleCharacterSheetPresetIds).toEqual(["1", "3"]);
    expect(result.current.characterDescription).toBe("Primary description");
    expect(result.current.characterSheetPresetAssignments.portrait?.previewUrl).toBe(
      "https://signed.example/preset-1.png"
    );
  });
});
