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
  createEmptyCharacterSheetPresetAssignments,
  createEmptyCharacterSlotMap,
} from "../../constants";
import { useCharacterManagerDraft } from "../useCharacterManagerDraft";
import { readSupabaseUserId } from "../../../../lib/supabaseClient";
import {
  clearCharacterManagerProfileImage,
  deleteCharacterManagerDraft,
  deleteCharacterManagerCharacterSheetPreset,
  loadCharacterManagerDraftByCharacterId,
  loadLatestCharacterManagerDraft,
  listCharacterManagerCharacters,
  saveCharacterManagerDraft,
  saveCharacterManagerActiveCharacterSheetPreset,
  saveCharacterManagerCharacterSheetAssignments,
  saveCharacterManagerCharacterSheetPresetAsset,
  saveCharacterManagerCharacterSheetPresetAssignments,
  saveCharacterManagerCharacterSheetPresetTabDescription,
  saveCharacterManagerProfileImage,
  saveCharacterManagerSlot,
  updateCharacterManagerName,
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
  loadLatestCharacterManagerDraft: vi.fn(),
  listCharacterManagerCharacters: vi.fn(),
  loadCharacterManagerDraftByCharacterId: vi.fn(),
  saveCharacterManagerActiveCharacterSheetPreset: vi.fn(),
  saveCharacterManagerDraft: vi.fn(),
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
const loadLatestCharacterManagerDraftMock = vi.mocked(loadLatestCharacterManagerDraft);
const loadCharacterManagerDraftByCharacterIdMock = vi.mocked(
  loadCharacterManagerDraftByCharacterId
);
const listCharacterManagerCharactersMock = vi.mocked(listCharacterManagerCharacters);
const saveCharacterManagerDraftMock = vi.mocked(saveCharacterManagerDraft);
const saveCharacterManagerActiveCharacterSheetPresetMock = vi.mocked(
  saveCharacterManagerActiveCharacterSheetPreset
);
const saveCharacterManagerCharacterSheetAssignmentsMock = vi.mocked(
  saveCharacterManagerCharacterSheetAssignments
);
const saveCharacterManagerCharacterSheetPresetAssetMock = vi.mocked(
  saveCharacterManagerCharacterSheetPresetAsset
);
const saveCharacterManagerCharacterSheetPresetAssignmentsMock = vi.mocked(
  saveCharacterManagerCharacterSheetPresetAssignments
);
const saveCharacterManagerCharacterSheetPresetTabDescriptionMock = vi.mocked(
  saveCharacterManagerCharacterSheetPresetTabDescription
);
const saveCharacterManagerProfileImageMock = vi.mocked(saveCharacterManagerProfileImage);
const clearCharacterManagerProfileImageMock = vi.mocked(clearCharacterManagerProfileImage);
const updateCharacterManagerNameMock = vi.mocked(updateCharacterManagerName);
const deleteCharacterManagerDraftMock = vi.mocked(deleteCharacterManagerDraft);
const saveCharacterManagerSlotMock = vi.mocked(saveCharacterManagerSlot);
const deleteCharacterManagerCharacterSheetPresetMock = vi.mocked(
  deleteCharacterManagerCharacterSheetPreset
);
const publishCharacterListChangedMock = vi.mocked(publishCharacterListChanged);
const persistSelectedCharacterIdMock = vi.mocked(persistSelectedCharacterId);
const readPersistedSelectedCharacterIdMock = vi.mocked(readPersistedSelectedCharacterId);
const validateCharacterReferenceFileMock = vi.mocked(validateCharacterReferenceFile);

type DraftSnapshot = NonNullable<Awaited<ReturnType<typeof loadLatestCharacterManagerDraft>>>;

const createPresetMedia = (id: string, previewUrl: string | null) => ({
  characterMediaId: `media-${id}`,
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
  loadLatestCharacterManagerDraftMock.mockResolvedValue(snapshot);
  listCharacterManagerCharactersMock.mockResolvedValue([
    {
      characterId: snapshot.characterId,
      characterName: snapshot.characterName,
      profileImageUrl: snapshot.profileImageUrl,
      updatedAt: "2026-03-17T00:00:00.000Z",
    },
  ] as never);
};

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

describe("useCharacterManagerDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(createDraftSnapshot() as never);
    saveCharacterManagerCharacterSheetAssignmentsMock.mockResolvedValue(
      createEmptyCharacterSheetAssignments() as never
    );
    saveCharacterManagerCharacterSheetPresetAssignmentsMock.mockResolvedValue(
      createDefaultCharacterSheetPresetState() as never
    );
  });

  it("uses the user-scoped persisted selection during bootstrap", async () => {
    const snapshot = createDraftSnapshot();
    readSupabaseUserIdMock.mockResolvedValue(snapshot.userId);
    readPersistedSelectedCharacterIdMock.mockReturnValue("char-scoped");
    loadLatestCharacterManagerDraftMock.mockResolvedValue(snapshot);
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
    expect(loadLatestCharacterManagerDraftMock).toHaveBeenCalledWith("char-scoped");
    expect(persistSelectedCharacterIdMock).toHaveBeenCalledWith("char-1", { userId: "user-1" });
  });

  it("boots into a local unsaved draft when the library is empty", async () => {
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    readPersistedSelectedCharacterIdMock.mockReturnValue(null);
    loadLatestCharacterManagerDraftMock.mockResolvedValue(null);
    listCharacterManagerCharactersMock.mockResolvedValue([] as never);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.selectedCharacterId).toBeNull();
    expect(result.current.hasUnsavedCharacterDraft).toBe(true);
    expect(result.current.characterName).toBe("New Character");
    expect(result.current.characterDescription).toBe("");
    expect(persistSelectedCharacterIdMock).toHaveBeenCalledWith(null, { userId: "user-1" });
  });

  it("only persists a new character when saveCharacter is pressed", async () => {
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    readPersistedSelectedCharacterIdMock.mockReturnValue(null);
    loadLatestCharacterManagerDraftMock.mockResolvedValue(null);
    listCharacterManagerCharactersMock.mockResolvedValueOnce([] as never).mockResolvedValueOnce([
      {
        characterId: "char-saved",
        characterName: "Fresh Save",
        profileImageUrl: null,
        updatedAt: "2026-03-17T00:00:01.000Z",
      },
    ] as never);
    saveCharacterManagerDraftMock.mockResolvedValue({
      ...createDraftSnapshot(),
      characterId: "char-saved",
      characterSheetId: "sheet-saved",
      characterName: "Fresh Save",
      characterDescription: "Saved description",
      characterSheetPresetDescriptions: {
        ...createDraftSnapshot().characterSheetPresetDescriptions,
        "1": "Saved description",
      },
    } as never);
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue({
      ...createDraftSnapshot(),
      characterId: "char-saved",
      characterSheetId: "sheet-saved",
      characterName: "Fresh Save",
      characterDescription: "Saved description",
      characterSheetPresetDescriptions: {
        ...createDraftSnapshot().characterSheetPresetDescriptions,
        "1": "Saved description",
      },
    } as never);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBeNull();
    });

    act(() => {
      result.current.setCharacterName("Fresh Save");
      result.current.setCharacterDescription("Saved description");
    });

    await act(async () => {
      const ok = await result.current.saveCharacter();
      expect(ok).toBe(true);
    });

    expect(saveCharacterManagerDraftMock).toHaveBeenCalledWith({
      name: "Fresh Save",
      activeCharacterSheetPresetId: "1",
      visibleCharacterSheetPresetIds: createDefaultCharacterSheetPresetState().tabOrder,
      characterSheetPresetLabels: expect.objectContaining({ "1": "1" }),
      characterSheetPresetDescriptions: expect.objectContaining({ "1": "Saved description" }),
    });
    await waitFor(() => {
      expect(result.current.selectedCharacterId).toBe("char-saved");
      expect(result.current.hasUnsavedCharacterDraft).toBe(false);
      expect(result.current.characters[0]?.characterId).toBe("char-saved");
    });
  });

  it("reports phase-specific progress while first save is in flight", async () => {
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    readPersistedSelectedCharacterIdMock.mockReturnValue(null);
    loadLatestCharacterManagerDraftMock.mockResolvedValue(null);
    listCharacterManagerCharactersMock.mockResolvedValue([] as never);
    const draftSave = createDeferred<DraftSnapshot>();
    const assignmentSave =
      createDeferred<ReturnType<typeof createEmptyCharacterSheetAssignments>>();
    const hydratedSave = createDeferred<DraftSnapshot>();
    const initialSnapshot = {
      ...createDraftSnapshot(),
      characterId: "char-saved",
      characterSheetId: "sheet-saved",
      characterName: "Fresh Save",
    } as DraftSnapshot;
    const hydratedSnapshot = {
      ...initialSnapshot,
      characterDescription: "Hydrated description",
    } as DraftSnapshot;
    saveCharacterManagerDraftMock.mockReturnValue(
      draftSave.promise as ReturnType<typeof saveCharacterManagerDraft>
    );
    saveCharacterManagerCharacterSheetAssignmentsMock.mockReturnValue(
      assignmentSave.promise as ReturnType<typeof saveCharacterManagerCharacterSheetAssignments>
    );
    loadCharacterManagerDraftByCharacterIdMock.mockReturnValue(
      hydratedSave.promise as ReturnType<typeof loadCharacterManagerDraftByCharacterId>
    );

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBeNull();
    });

    let savePromise!: Promise<boolean>;
    act(() => {
      savePromise = result.current.saveCharacter();
    });

    await waitFor(() => {
      expect(result.current.isSavingCharacter).toBe(true);
      expect(result.current.characterSaveProgressMessage).toBe("Creating character...");
    });

    await act(async () => {
      draftSave.resolve(initialSnapshot);
      await draftSave.promise;
    });

    await waitFor(() => {
      expect(result.current.characterSaveProgressMessage).toBe("Saving references...");
    });

    await act(async () => {
      assignmentSave.resolve(createEmptyCharacterSheetAssignments());
      await assignmentSave.promise;
    });

    await waitFor(() => {
      expect(result.current.characterSaveProgressMessage).toBe("Loading saved character...");
    });

    await act(async () => {
      hydratedSave.resolve(hydratedSnapshot);
      await savePromise;
    });

    expect(await savePromise).toBe(true);
    expect(result.current.isSavingCharacter).toBe(false);
    expect(result.current.characterSaveProgressMessage).toBeNull();
    expect(result.current.selectedCharacterId).toBe("char-saved");
  });

  it("ignores a stale first-save response after the local draft is reset", async () => {
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    readPersistedSelectedCharacterIdMock.mockReturnValue(null);
    loadLatestCharacterManagerDraftMock.mockResolvedValue(null);
    listCharacterManagerCharactersMock.mockResolvedValue([] as never);
    const draftSave = createDeferred<DraftSnapshot>();
    const initialSnapshot = {
      ...createDraftSnapshot(),
      characterId: "char-stale",
      characterSheetId: "sheet-stale",
      characterName: "Stale Save",
    } as DraftSnapshot;
    saveCharacterManagerDraftMock.mockReturnValue(
      draftSave.promise as ReturnType<typeof saveCharacterManagerDraft>
    );

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBeNull();
    });

    let savePromise!: Promise<boolean>;
    act(() => {
      savePromise = result.current.saveCharacter();
    });

    await waitFor(() => {
      expect(result.current.isSavingCharacter).toBe(true);
      expect(result.current.characterSaveProgressMessage).toBe("Creating character...");
    });

    await act(async () => {
      await result.current.createCharacter();
    });

    expect(result.current.isSavingCharacter).toBe(false);
    expect(result.current.characterSaveProgressMessage).toBeNull();

    await act(async () => {
      draftSave.resolve(initialSnapshot);
      await savePromise;
    });

    expect(await savePromise).toBe(false);
    expect(loadCharacterManagerDraftByCharacterIdMock).not.toHaveBeenCalledWith("char-stale");
    expect(publishCharacterListChangedMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: "create" })
    );
    expect(result.current.selectedCharacterId).toBeNull();
    expect(result.current.characters).toEqual([]);
  });

  it("clears persisted selection when staging a new local draft", async () => {
    const snapshot = createDraftSnapshot();
    configureBootstrap(snapshot);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBe("char-1");
    });

    await act(async () => {
      await result.current.createCharacter();
    });

    await waitFor(() => {
      expect(result.current.selectedCharacterId).toBeNull();
      expect(result.current.hasUnsavedCharacterDraft).toBe(true);
      expect(result.current.characterName).toBe("New Character");
    });

    expect(persistSelectedCharacterIdMock).toHaveBeenLastCalledWith(null, { userId: "user-1" });
  });

  it("clears staged draft media when starting a fresh local draft", async () => {
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    readPersistedSelectedCharacterIdMock.mockReturnValue(null);
    loadLatestCharacterManagerDraftMock.mockResolvedValue(null);
    listCharacterManagerCharactersMock.mockResolvedValueOnce([] as never).mockResolvedValueOnce([
      {
        characterId: "char-saved",
        characterName: "Fresh Save",
        profileImageUrl: null,
        updatedAt: "2026-03-17T00:00:01.000Z",
      },
    ] as never);
    saveCharacterManagerDraftMock.mockResolvedValue({
      ...createDraftSnapshot(),
      characterId: "char-saved",
      characterSheetId: "sheet-saved",
      characterName: "Fresh Save",
    } as never);
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue({
      ...createDraftSnapshot(),
      characterId: "char-saved",
      characterSheetId: "sheet-saved",
      characterName: "Fresh Save",
    } as never);
    saveCharacterManagerCharacterSheetAssignmentsMock.mockResolvedValue(
      createEmptyCharacterSheetAssignments() as never
    );
    validateCharacterReferenceFileMock.mockResolvedValue({
      status: "pass",
      notes: {
        validatorVersion: 1,
        mimeType: "image/png",
        width: 1024,
        height: 1280,
        aspectRatio: 0.8,
        sha256: "front-full",
        hardErrors: [],
        warnings: [],
        evaluatedAt: "2026-03-17T00:00:00.000Z",
      },
    } as never);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBeNull();
    });

    await act(async () => {
      await result.current.setProfileImageFile(
        new File(["profile"], "profile.png", { type: "image/png" })
      );
      await result.current.setCharacterSheetPresetFile(
        "portrait",
        new File(["preset"], "preset.png", { type: "image/png" })
      );
      await result.current.setSlotFile(
        "front_full",
        new File(["slot"], "front-full.png", { type: "image/png" })
      );
    });

    expect(result.current.profileImageUrl).toMatch(/^blob:/);
    expect(result.current.characterSheetPresetAssignments.portrait?.previewUrl).toMatch(/^blob:/);
    expect(result.current.slots.front_full?.previewUrl).toMatch(/^blob:/);

    await act(async () => {
      await result.current.createCharacter();
    });

    expect(result.current.profileImageUrl).toBeNull();
    expect(result.current.characterSheetPresetAssignments.portrait).toBeNull();
    expect(result.current.slots.front_full).toBeNull();

    await act(async () => {
      const ok = await result.current.saveCharacter();
      expect(ok).toBe(true);
    });

    expect(saveCharacterManagerProfileImageMock).not.toHaveBeenCalled();
    expect(saveCharacterManagerCharacterSheetPresetAssetMock).not.toHaveBeenCalled();
    expect(saveCharacterManagerSlotMock).not.toHaveBeenCalled();
  });

  it("ignores stale character selection responses when a newer selection wins", async () => {
    const snapshot = createDraftSnapshot();
    configureBootstrap(snapshot);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBe("char-1");
    });

    const altSnapshot = {
      ...createDraftSnapshot(),
      characterId: "char-2",
      characterName: "Alt Hero",
    } as DraftSnapshot;
    const spareSnapshot = {
      ...createDraftSnapshot(),
      characterId: "char-3",
      characterName: "Spare Hero",
    } as DraftSnapshot;
    const altSelection = createDeferred<DraftSnapshot>();
    const spareSelection = createDeferred<DraftSnapshot>();

    loadCharacterManagerDraftByCharacterIdMock.mockImplementation((characterId: string) => {
      if (characterId === "char-2") {
        return altSelection.promise as ReturnType<typeof loadCharacterManagerDraftByCharacterId>;
      }
      if (characterId === "char-3") {
        return spareSelection.promise as ReturnType<typeof loadCharacterManagerDraftByCharacterId>;
      }
      throw new Error(`Unexpected character id: ${characterId}`);
    });

    await act(async () => {
      void result.current.selectCharacter("char-2");
      void result.current.selectCharacter("char-3");
    });

    await act(async () => {
      spareSelection.resolve(spareSnapshot);
      await spareSelection.promise;
    });

    await waitFor(() => {
      expect(result.current.selectedCharacterId).toBe("char-3");
      expect(result.current.characterName).toBe("Spare Hero");
    });

    await act(async () => {
      altSelection.resolve(altSnapshot);
      await altSelection.promise;
    });

    await waitFor(() => {
      expect(result.current.selectedCharacterId).toBe("char-3");
      expect(result.current.characterName).toBe("Spare Hero");
    });
  });

  it("stages local draft assets before save and flushes them during the first save", async () => {
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    readPersistedSelectedCharacterIdMock.mockReturnValue(null);
    loadLatestCharacterManagerDraftMock.mockResolvedValue(null);
    listCharacterManagerCharactersMock.mockResolvedValueOnce([] as never).mockResolvedValueOnce([
      {
        characterId: "char-saved",
        characterName: "Draft Hero",
        profileImageUrl: "https://signed.example/profile-saved.png",
        updatedAt: "2026-03-17T00:00:01.000Z",
      },
    ] as never);
    const persistedPresetAsset = createPresetMedia(
      "draft-portrait",
      "https://signed.example/preset-draft.png"
    );
    const hydratedSnapshot = {
      ...createDraftSnapshot(),
      characterId: "char-saved",
      characterSheetId: "sheet-saved",
      characterName: "Draft Hero",
      profileImageUrl: "https://signed.example/profile-saved.png",
      characterSheetPresets: {
        ...createDraftSnapshot().characterSheetPresets,
        "1": {
          ...createDraftSnapshot().characterSheetPresets["1"],
          portrait: persistedPresetAsset,
        },
      },
      characterSheetPresetAssignments: {
        ...createDraftSnapshot().characterSheetPresets["1"],
        portrait: persistedPresetAsset,
      },
      slots: {
        ...createEmptyCharacterSlotMap(),
        front_full: {
          characterMediaId: "media-front-full",
          storagePath: "characters/char-saved/front-full.png",
          validationStatus: "pass",
          validationNotes: {
            validatorVersion: 1,
            mimeType: "image/png",
            width: 1024,
            height: 1280,
            aspectRatio: 0.8,
            sha256: "front-full",
            hardErrors: [],
            warnings: [],
            evaluatedAt: "2026-03-17T00:00:00.000Z",
          },
          name: "front-full.png",
          size: 1024,
          type: "image/png",
          previewUrl: "https://signed.example/front-full.png",
          updatedAt: "2026-03-17T00:00:00.000Z",
        },
      },
    } as DraftSnapshot;
    saveCharacterManagerDraftMock.mockResolvedValue({
      ...hydratedSnapshot,
      profileImageUrl: null,
      characterSheetPresets: createDefaultCharacterSheetPresetState().presets,
      characterSheetPresetAssignments: createEmptyCharacterSheetPresetAssignments(),
      slots: createEmptyCharacterSlotMap(),
    } as never);
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(hydratedSnapshot as never);
    saveCharacterManagerProfileImageMock.mockResolvedValue({
      signedUrl: "https://signed.example/profile-saved.png",
      characterMediaId: "media-profile-saved",
      previewStoragePath: "user-1/characters/char-saved/profile/profile-saved.png",
      storagePath: "user-1/characters/char-saved/profile/profile-saved.png",
    } as never);
    saveCharacterManagerCharacterSheetPresetAssetMock.mockResolvedValue(
      persistedPresetAsset as never
    );
    saveCharacterManagerCharacterSheetPresetAssignmentsMock.mockResolvedValue(
      createDefaultCharacterSheetPresetState() as never
    );
    saveCharacterManagerCharacterSheetPresetTabDescriptionMock.mockResolvedValue({
      activePresetId: "1",
      tabOrder: createDefaultCharacterSheetPresetState().tabOrder,
      tabLabels: createDefaultCharacterSheetPresetLabels(),
      tabDescriptions: createDefaultCharacterSheetPresetDescriptions(),
      presets: createDefaultCharacterSheetPresetState().presets,
    } as never);
    saveCharacterManagerCharacterSheetAssignmentsMock.mockResolvedValue(
      createEmptyCharacterSheetAssignments() as never
    );
    validateCharacterReferenceFileMock.mockResolvedValue({
      status: "pass",
      notes: {
        validatorVersion: 1,
        mimeType: "image/png",
        width: 1024,
        height: 1280,
        aspectRatio: 0.8,
        sha256: "front-full",
        hardErrors: [],
        warnings: [],
        evaluatedAt: "2026-03-17T00:00:00.000Z",
      },
    } as never);
    saveCharacterManagerSlotMock.mockResolvedValue(hydratedSnapshot.slots.front_full as never);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBeNull();
    });

    const profileFile = new File(["profile"], "profile.png", { type: "image/png" });
    const presetFile = new File(["preset"], "preset.png", { type: "image/png" });
    const slotFile = new File(["slot"], "front-full.png", { type: "image/png" });

    await act(async () => {
      await result.current.setProfileImageFile(profileFile);
      await result.current.setCharacterSheetPresetFile("portrait", presetFile);
      await result.current.setSlotFile("front_full", slotFile);
    });

    expect(result.current.profileImageUrl).toMatch(/^blob:/);
    expect(result.current.characterSheetPresetAssignments.portrait?.previewUrl).toMatch(/^blob:/);
    expect(result.current.slots.front_full?.previewUrl).toMatch(/^blob:/);

    await act(async () => {
      const ok = await result.current.saveCharacter();
      expect(ok).toBe(true);
    });

    expect(saveCharacterManagerProfileImageMock).toHaveBeenCalledWith({
      characterId: "char-saved",
      file: profileFile,
    });
    expect(saveCharacterManagerCharacterSheetPresetAssetMock).toHaveBeenCalledWith({
      characterId: "char-saved",
      file: presetFile,
    });
    expect(saveCharacterManagerCharacterSheetPresetAssignmentsMock).toHaveBeenCalledWith({
      characterId: "char-saved",
      presetId: "1",
      assignments: expect.objectContaining({
        portrait: persistedPresetAsset,
      }),
    });
    expect(saveCharacterManagerSlotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: "char-saved",
        characterSheetId: "sheet-saved",
        slotKey: "front_full",
        file: slotFile,
      })
    );
    expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-saved");

    await waitFor(() => {
      expect(result.current.selectedCharacterId).toBe("char-saved");
      expect(result.current.profileImageUrl).toBe("https://signed.example/profile-saved.png");
      expect(result.current.characterSheetPresetAssignments.portrait?.previewUrl).toBe(
        "https://signed.example/preset-draft.png"
      );
      expect(result.current.slots.front_full?.previewUrl).toBe(
        "https://signed.example/front-full.png"
      );
    });
  });

  it("allows preset tabs to be added and switched before the first save", async () => {
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    readPersistedSelectedCharacterIdMock.mockReturnValue(null);
    loadLatestCharacterManagerDraftMock.mockResolvedValue(null);
    listCharacterManagerCharactersMock.mockResolvedValue([] as never);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBeNull();
    });

    await act(async () => {
      const added = await result.current.addCharacterSheetPreset();
      expect(added).toBe(true);
    });

    expect(result.current.visibleCharacterSheetPresetIds).toEqual([
      ...createDefaultCharacterSheetPresetState().tabOrder,
      "5",
    ]);
    expect(result.current.activeCharacterSheetPresetId).toBe("5");

    await act(async () => {
      const switched = await result.current.setActiveCharacterSheetPreset("1");
      expect(switched).toBe(true);
    });

    expect(result.current.activeCharacterSheetPresetId).toBe("1");
    expect(saveCharacterManagerActiveCharacterSheetPresetMock).not.toHaveBeenCalled();
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

  it("switches characters without reloading the full library", async () => {
    const snapshot = createDraftSnapshot();
    configureBootstrap(snapshot);
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue({
      ...snapshot,
      characterId: "char-2",
      characterSheetId: "sheet-2",
      characterName: "Ayla",
      characterDescription: "Second description",
    } as never);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBe("char-1");
    });

    await act(async () => {
      await result.current.selectCharacter("char-2");
    });

    await waitFor(() => {
      expect(result.current.selectedCharacterId).toBe("char-2");
      expect(result.current.characterName).toBe("Ayla");
    });

    expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-2");
    expect(listCharacterManagerCharactersMock).toHaveBeenCalledTimes(1);
  });

  it("flushes pending name and description edits when saving an existing character", async () => {
    const snapshot = createDraftSnapshot();
    configureBootstrap(snapshot);
    updateCharacterManagerNameMock.mockResolvedValue(undefined as never);
    saveCharacterManagerCharacterSheetPresetTabDescriptionMock.mockResolvedValue({
      activePresetId: "1",
      tabOrder: snapshot.visibleCharacterSheetPresetIds,
      tabLabels: snapshot.characterSheetPresetLabels,
      tabDescriptions: {
        ...snapshot.characterSheetPresetDescriptions,
        "1": "Updated description",
      },
      presets: snapshot.characterSheetPresets,
    } as never);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBe("char-1");
    });

    act(() => {
      result.current.setCharacterName("Updated Hero");
      result.current.setCharacterDescription("Updated description");
    });

    await act(async () => {
      const ok = await result.current.saveCharacter();
      expect(ok).toBe(true);
    });

    expect(updateCharacterManagerNameMock).toHaveBeenCalledWith({
      characterId: "char-1",
      name: "Updated Hero",
    });
    expect(saveCharacterManagerCharacterSheetPresetTabDescriptionMock).toHaveBeenCalledWith({
      characterId: "char-1",
      presetId: "1",
      description: "Updated description",
    });
  });

  it("suppresses persisted selection on externally controlled surfaces and follows preferred ids", async () => {
    const snapshot = createDraftSnapshot();
    readSupabaseUserIdMock.mockResolvedValue(snapshot.userId);
    listCharacterManagerCharactersMock.mockResolvedValue([
      {
        characterId: "char-1",
        characterName: "Hero",
        profileImageUrl: null,
        updatedAt: "2026-03-17T00:00:00.000Z",
      },
      {
        characterId: "char-2",
        characterName: "Ayla",
        profileImageUrl: null,
        updatedAt: "2026-03-17T00:00:01.000Z",
      },
    ] as never);
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue({
      ...snapshot,
      characterId: "char-2",
      characterSheetId: "sheet-2",
      characterName: "Ayla",
      characterDescription: "Second description",
    } as never);

    const { result, rerender } = renderHook(
      ({ preferredCharacterId }: { preferredCharacterId: string | null }) =>
        useCharacterManagerDraft({
          preferredCharacterId,
          suppressSelectedCharacterPersistence: true,
        }),
      {
        initialProps: {
          preferredCharacterId: null as string | null,
        },
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBeNull();
    });

    expect(readPersistedSelectedCharacterIdMock).not.toHaveBeenCalled();
    expect(loadLatestCharacterManagerDraftMock).not.toHaveBeenCalled();
    expect(persistSelectedCharacterIdMock).not.toHaveBeenCalled();

    rerender({
      preferredCharacterId: "char-2",
    });

    await waitFor(() => {
      expect(result.current.selectedCharacterId).toBe("char-2");
      expect(result.current.characterName).toBe("Ayla");
    });

    expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-2");
    expect(persistSelectedCharacterIdMock).not.toHaveBeenCalled();
  });

  it("reselects the next character after delete without an extra list refresh", async () => {
    const snapshot = createDraftSnapshot();
    readSupabaseUserIdMock.mockResolvedValue(snapshot.userId);
    readPersistedSelectedCharacterIdMock.mockReturnValue(null);
    loadLatestCharacterManagerDraftMock.mockResolvedValue(snapshot);
    listCharacterManagerCharactersMock
      .mockResolvedValueOnce([
        {
          characterId: "char-1",
          characterName: "Hero",
          profileImageUrl: null,
          updatedAt: "2026-03-17T00:00:00.000Z",
        },
        {
          characterId: "char-2",
          characterName: "Ayla",
          profileImageUrl: null,
          updatedAt: "2026-03-17T00:00:01.000Z",
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          characterId: "char-2",
          characterName: "Ayla",
          profileImageUrl: null,
          updatedAt: "2026-03-17T00:00:01.000Z",
        },
      ] as never);
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue({
      ...snapshot,
      characterId: "char-2",
      characterSheetId: "sheet-2",
      characterName: "Ayla",
      characterDescription: "Second description",
    } as never);

    const { result } = renderHook(() => useCharacterManagerDraft());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.selectedCharacterId).toBe("char-1");
    });

    await act(async () => {
      const ok = await result.current.deleteCharacter("char-1");
      expect(ok).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.selectedCharacterId).toBe("char-2");
      expect(result.current.characters).toHaveLength(1);
      expect(result.current.characters[0]?.characterId).toBe("char-2");
    });

    expect(deleteCharacterManagerDraftMock).toHaveBeenCalledWith({ characterId: "char-1" });
    expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-2");
    expect(listCharacterManagerCharactersMock).toHaveBeenCalledTimes(1);
    expect(publishCharacterListChangedMock).toHaveBeenCalledWith({
      userId: "user-1",
      reason: "delete",
    });
  });

  it("uploads a profile image and refreshes the character rail", async () => {
    const snapshot = createDraftSnapshot();
    readSupabaseUserIdMock.mockResolvedValue(snapshot.userId);
    readPersistedSelectedCharacterIdMock.mockReturnValue(null);
    loadLatestCharacterManagerDraftMock.mockResolvedValue(snapshot);
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
      ] as never)
      .mockResolvedValueOnce([
        {
          characterId: snapshot.characterId,
          characterName: snapshot.characterName,
          profileImageUrl: "https://signed.example/profile.png",
          updatedAt: "2026-03-17T00:00:01.000Z",
        },
      ] as never);
    saveCharacterManagerProfileImageMock.mockResolvedValue({
      signedUrl: "https://signed.example/profile.png",
      characterMediaId: "media-profile-1",
      previewStoragePath: "user-1/characters/char-1/profile/profile.png",
      storagePath: "user-1/characters/char-1/profile/profile.png",
    } as never);

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
      characterMediaId: "slot-1",
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
