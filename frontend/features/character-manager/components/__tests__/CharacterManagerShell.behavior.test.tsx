/**
 * Character Manager interaction tests.
 * Verifies Character Sheet drag/drop behavior and dynamic QuickSwap deck intake.
 */
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterManagerShell } from "../CharacterManagerShell";
import { INTERNAL_REFERENCE_DRAG_ORIGIN } from "../../../ai-studio/utils/dragDrop";
import {
  CHARACTER_SHEET_PRESET_IDS,
  createDefaultCharacterSheetPresetState,
  createEmptyCharacterSheetAssignments,
  createEmptyCharacterSheetPresetAssignments,
} from "../../constants";
import { getNextCharacterSheetPresetId } from "../../logic/characterSheetPresetTabs";
import type {
  CharacterSheetDropZoneKey,
  CharacterSheetPresetAssignments,
  CharacterSheetPresetId,
  CharacterSheetPresetMap,
} from "../../types";

type MockCharacterReferenceSlotKey =
  | "front_full"
  | "side_profile"
  | "back_full"
  | "top_down"
  | "front_left_34"
  | "front_right_34"
  | "back_left_34"
  | "back_right_34"
  | "portrait_close"
  | "fullbody_wide";

type MockCharacterSlotFile = {
  mediaFileId: string;
  storagePath: string;
  validationStatus: "pass";
  validationNotes: {
    validatorVersion: number;
    mimeType: string;
    width: number;
    height: number;
    aspectRatio: number;
    sha256: string;
    hardErrors: string[];
    warnings: string[];
    evaluatedAt: string;
  };
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  updatedAt: string;
};

type MockCharacterSlotFileMap = Record<MockCharacterReferenceSlotKey, MockCharacterSlotFile | null>;

type MockSupabaseMediaLookupResponse = {
  data: { storage_path: string } | null;
  error: { message: string } | null;
};

type MockSupabaseStorageDownloadResponse = {
  data: Blob | null;
  error: { message: string } | null;
};

type MockCharacterListEntry = {
  characterId: string;
  characterName: string;
  profileImageUrl: string | null;
  profileImageTransform: null;
};

const MOCK_SLOT_KEYS: MockCharacterReferenceSlotKey[] = [
  "front_full",
  "side_profile",
  "back_full",
  "top_down",
  "front_left_34",
  "front_right_34",
  "back_left_34",
  "back_right_34",
  "portrait_close",
  "fullbody_wide",
];
const TEST_SUPABASE_URL = "https://jwmcytzyhcvacjwqtynn.supabase.co";
const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const buildEmptySlots = (): MockCharacterSlotFileMap =>
  MOCK_SLOT_KEYS.reduce((acc, slotKey) => {
    acc[slotKey] = null;
    return acc;
  }, {} as MockCharacterSlotFileMap);

const createMockSlotFile = (
  slotKey: MockCharacterReferenceSlotKey,
  previewUrl: string
): MockCharacterSlotFile => ({
  mediaFileId: `media-${slotKey}`,
  storagePath: `${slotKey}.png`,
  validationStatus: "pass",
  validationNotes: {
    validatorVersion: 1,
    mimeType: "image/png",
    width: 1024,
    height: 1280,
    aspectRatio: 0.8,
    sha256: `${slotKey}-hash`,
    hardErrors: [],
    warnings: [],
    evaluatedAt: "2026-01-01T00:00:00.000Z",
  },
  name: `${slotKey}.png`,
  size: 1024,
  type: "image/png",
  previewUrl,
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const createInitialSlots = (): MockCharacterSlotFileMap => ({
  ...buildEmptySlots(),
  front_full: createMockSlotFile("front_full", "https://example.com/front-full-initial.png"),
  side_profile: createMockSlotFile("side_profile", "https://example.com/side-profile-initial.png"),
});

type MockQuickSwapItem = {
  id: string;
  mediaFileId: string;
  storagePath: string;
  previewUrl: string;
  status: "active" | "archived";
  createdAt: string;
  archivedAt: string | null;
  legacySlotKey: MockCharacterReferenceSlotKey | null;
};

const createInitialQuickSwapItems = (): MockQuickSwapItem[] => [
  {
    id: "qs-1",
    mediaFileId: "media-front-full",
    storagePath: "quick/front-full.png",
    previewUrl: "https://example.com/front-full-initial.png",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    legacySlotKey: "front_full",
  },
  {
    id: "qs-2",
    mediaFileId: "media-side-profile",
    storagePath: "quick/side-profile.png",
    previewUrl: "https://example.com/side-profile-initial.png",
    status: "active",
    createdAt: "2026-01-01T00:00:01.000Z",
    archivedAt: null,
    legacySlotKey: "side_profile",
  },
];

const createInitialPresetMap = (): CharacterSheetPresetMap =>
  createDefaultCharacterSheetPresetState().presets;

const createDataTransfer = (files: File[] = []) => {
  const dataStore = new Map<string, string>();
  return {
    files,
    get types() {
      const keys = Array.from(dataStore.keys());
      if (files.length > 0 && !keys.includes("Files")) {
        keys.unshift("Files");
      }
      return keys;
    },
    effectAllowed: "all",
    dropEffect: "move",
    setDragImage: () => undefined,
    setData: (type: string, value: string) => {
      dataStore.set(type, value);
    },
    getData: (type: string) => dataStore.get(type) ?? "",
  };
};

const addInternalReferenceDragPayload = (
  transfer: ReturnType<typeof createDataTransfer>,
  options?: {
    outputId?: string;
    mediaId?: string;
    imageIndex?: number;
    sourceSurface?: "all-refs" | "curated";
    referenceUrl?: string;
  }
) => {
  const outputId = options?.outputId ?? "output-internal-1";
  transfer.setData("text/reference-origin", INTERNAL_REFERENCE_DRAG_ORIGIN);
  transfer.setData("text/reference-version", "1");
  transfer.setData("text/reference-id", outputId);
  transfer.setData("text/reference-output-id", outputId);
  transfer.setData("text/reference-image-index", String(options?.imageIndex ?? 0));
  transfer.setData("text/reference-source-surface", options?.sourceSurface ?? "all-refs");
  if (options?.mediaId) {
    transfer.setData("text/reference-media-id", options.mediaId);
  }
  if (options?.referenceUrl) {
    transfer.setData("text/reference-url", options.referenceUrl);
  }
};

const supabaseClientMockState = vi.hoisted(() => ({
  mediaLookupMaybeSingle: vi.fn(
    async (): Promise<MockSupabaseMediaLookupResponse> => ({ data: null, error: null })
  ),
  storageDownload: vi.fn(
    async (): Promise<MockSupabaseStorageDownloadResponse> => ({
      data: null,
      error: { message: "not found" },
    })
  ),
}));

const characterManagerMockState = vi.hoisted(() => ({
  characters: [] as MockCharacterListEntry[],
  selectedCharacterId: "character-1",
}));

const quickSwapDeckMockState = vi.hoisted(() => ({
  appendExistingMediaReferenceImpl: null as null | ((mediaFileId: string) => Promise<boolean>),
}));

const getReferenceCard = (index: number): HTMLElement => {
  const removeButtons = screen.getAllByRole("button", { name: /Remove reference/i });
  const removeButton = removeButtons[index - 1];
  if (!removeButton) {
    throw new Error(`Unable to resolve remove button for reference index ${index}.`);
  }
  const card = removeButton.closest("article");
  if (!card) {
    throw new Error(`Unable to resolve reference card ${index}.`);
  }
  return card;
};

const clickRemoveReference = (index: number) => {
  const removeButtons = screen.getAllByRole("button", { name: /Remove reference/i });
  const removeButton = removeButtons[index - 1];
  if (!removeButton) {
    throw new Error(`Unable to resolve remove button for reference index ${index}.`);
  }
  fireEvent.click(removeButton);
};

const getCharacterSheetZone = (label: string): HTMLElement => {
  const zoneLabels = screen
    .getAllByText(label)
    .filter((candidate) => !candidate.closest(".character-drag-ghost"));
  const zoneLabel = zoneLabels[0];
  if (!zoneLabel) {
    throw new Error(`Unable to resolve Character Sheet zone label: ${label}.`);
  }
  const zoneCard = zoneLabel.closest("article");
  if (!zoneCard) {
    throw new Error(`Unable to resolve Character Sheet zone: ${label}.`);
  }
  return zoneCard;
};

const getZoneImageSrc = (label: string): string | null => {
  const zoneCard = getCharacterSheetZone(label);
  const zoneImage = zoneCard.querySelector(".character-character-sheet-image");
  return zoneImage?.getAttribute("src") ?? null;
};

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const sanitizedProps = { ...props };
    delete sanitizedProps.onLoadingComplete;
    delete sanitizedProps.unoptimized;
    return <div data-testid="mock-next-image" {...sanitizedProps} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("../../../../components/DashboardNavPrefab", () => ({
  DashboardNavPrefab: () => <span>Dashboard</span>,
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: supabaseClientMockState.mediaLookupMaybeSingle,
        }),
      }),
    }),
    storage: {
      from: () => ({
        download: supabaseClientMockState.storageDownload,
      }),
    },
  }),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: vi.fn(async ({ storagePath }: { storagePath: string }) =>
    storagePath ? `https://example.com/full-quality/${storagePath}` : null
  ),
}));

vi.mock("../../hooks/useCharacterManagerDraft", async () => {
  const React = await import("react");

  return {
    useCharacterManagerDraft: () => {
      const [slots, setSlots] = React.useState<MockCharacterSlotFileMap>(() =>
        createInitialSlots()
      );
      const [characterSheetAssignments, setCharacterSheetAssignments] = React.useState(() =>
        createEmptyCharacterSheetAssignments()
      );
      const [activeCharacterSheetPresetId, setActiveCharacterSheetPresetId] =
        React.useState<CharacterSheetPresetId>("1");
      const [characterSheetPresets, setCharacterSheetPresets] =
        React.useState<CharacterSheetPresetMap>(() => createInitialPresetMap());
      const [visibleCharacterSheetPresetIds, setVisibleCharacterSheetPresetIds] = React.useState<
        CharacterSheetPresetId[]
      >(["1"]);
      const [characterSheetPresetLabels, setCharacterSheetPresetLabels] = React.useState<
        Record<CharacterSheetPresetId, string>
      >(
        () =>
          Object.fromEntries(
            CHARACTER_SHEET_PRESET_IDS.map((presetId) => [presetId, presetId])
          ) as Record<CharacterSheetPresetId, string>
      );
      const [characterSheetPresetAssignments, setCharacterSheetPresetAssignments] =
        React.useState<CharacterSheetPresetAssignments>(() =>
          createEmptyCharacterSheetPresetAssignments()
        );
      const uploadCounterRef = React.useRef(0);
      const presetUploadCounterRef = React.useRef(0);
      const activePresetRef = React.useRef<CharacterSheetPresetId>("1");
      const presetMapRef = React.useRef<CharacterSheetPresetMap>(createInitialPresetMap());

      React.useEffect(() => {
        activePresetRef.current = activeCharacterSheetPresetId;
      }, [activeCharacterSheetPresetId]);

      React.useEffect(() => {
        presetMapRef.current = characterSheetPresets;
      }, [characterSheetPresets]);

      return {
        characters: characterManagerMockState.characters,
        selectedCharacterId: characterManagerMockState.selectedCharacterId,
        characterName: "Taylor",
        characterDescription: "",
        characterSheetAssignments,
        activeCharacterSheetPresetId,
        characterSheetPresets,
        visibleCharacterSheetPresetIds,
        characterSheetPresetLabels,
        characterSheetPresetAssignments,
        profileImageUrl: null,
        profileImageTransform: {
          zoom: 1,
          offsetX: 0,
          offsetY: 0,
        },
        slots,
        error: null,
        loading: false,
        isSavingName: false,
        isCreatingCharacter: false,
        isDeletingCharacter: false,
        isSwitchingCharacter: false,
        isSavingProfileImage: false,
        isSavingCharacterSheetPreset: false,
        setCharacterName: () => undefined,
        setCharacterDescription: () => undefined,
        setProfileImageFile: async () => undefined,
        saveProfileImageTransform: async () => true,
        clearProfileImage: async () => undefined,
        saveCharacterSheetAssignments: async (
          assignments: ReturnType<typeof createEmptyCharacterSheetAssignments>
        ) => {
          setCharacterSheetAssignments(assignments);
          return true;
        },
        setActiveCharacterSheetPreset: async (presetId: CharacterSheetPresetId) => {
          setActiveCharacterSheetPresetId(presetId);
          setCharacterSheetPresetAssignments(
            presetMapRef.current[presetId] ?? createEmptyCharacterSheetPresetAssignments()
          );
          return true;
        },
        saveCharacterSheetPresetAssignments: async (
          assignments: CharacterSheetPresetAssignments
        ) => {
          const activePreset = activePresetRef.current;
          setCharacterSheetPresets((previous) => ({
            ...previous,
            [activePreset]: assignments,
          }));
          setCharacterSheetPresetAssignments(assignments);
          return true;
        },
        addCharacterSheetPreset: async () => {
          const nextPresetId = getNextCharacterSheetPresetId(visibleCharacterSheetPresetIds);
          if (!nextPresetId) return false;
          setVisibleCharacterSheetPresetIds((previous) => [...previous, nextPresetId]);
          setActiveCharacterSheetPresetId(nextPresetId);
          setCharacterSheetPresetAssignments(
            presetMapRef.current[nextPresetId] ?? createEmptyCharacterSheetPresetAssignments()
          );
          return true;
        },
        renameCharacterSheetPreset: async (presetId: CharacterSheetPresetId, nextLabel: string) => {
          setCharacterSheetPresetLabels((previous) => ({
            ...previous,
            [presetId]: nextLabel.trim() || presetId,
          }));
          return true;
        },
        deleteCharacterSheetPreset: async (presetId: CharacterSheetPresetId) => {
          if (presetId === "1") {
            return false;
          }
          const deletedPresetIndex = visibleCharacterSheetPresetIds.indexOf(presetId);
          const nextVisiblePresetIds = visibleCharacterSheetPresetIds.filter(
            (visiblePresetId) => visiblePresetId !== presetId
          );
          if (!nextVisiblePresetIds.length) {
            return false;
          }
          const nearestLeftPresetId =
            deletedPresetIndex > 0
              ? (visibleCharacterSheetPresetIds[deletedPresetIndex - 1] ?? null)
              : null;
          const nearestRightPresetId =
            deletedPresetIndex >= 0
              ? (visibleCharacterSheetPresetIds[deletedPresetIndex + 1] ?? null)
              : null;
          const nextActivePresetId =
            activePresetRef.current === presetId
              ? (nearestLeftPresetId ?? nearestRightPresetId ?? nextVisiblePresetIds[0] ?? "1")
              : activePresetRef.current;
          const nextPresetMap = {
            ...presetMapRef.current,
            [presetId]: createEmptyCharacterSheetPresetAssignments(),
          };
          setCharacterSheetPresets(nextPresetMap);
          setVisibleCharacterSheetPresetIds(nextVisiblePresetIds);
          setCharacterSheetPresetLabels((previous) => ({
            ...previous,
            [presetId]: presetId,
          }));
          setActiveCharacterSheetPresetId(nextActivePresetId);
          setCharacterSheetPresetAssignments(
            nextPresetMap[nextActivePresetId] ?? createEmptyCharacterSheetPresetAssignments()
          );
          return true;
        },
        setCharacterSheetPresetFile: async (zoneKey: CharacterSheetDropZoneKey) => {
          presetUploadCounterRef.current += 1;
          const uploadIndex = presetUploadCounterRef.current;
          const activePreset = activePresetRef.current;
          const nextAssignments = {
            ...(presetMapRef.current[activePreset] ?? createEmptyCharacterSheetPresetAssignments()),
            [zoneKey]: {
              mediaFileId: `preset-media-${activePreset}-${zoneKey}-${uploadIndex}`,
              storagePath: `user/chars/presets/${activePreset}/${zoneKey}-${uploadIndex}.png`,
              previewUrl: `https://example.com/preset-${activePreset}-${zoneKey}-${uploadIndex}.png`,
            },
          };
          setCharacterSheetPresets((previous) => ({
            ...previous,
            [activePreset]: nextAssignments,
          }));
          setCharacterSheetPresetAssignments(nextAssignments);
          return true;
        },
        setSlotFile: async (slotKey: MockCharacterReferenceSlotKey) => {
          uploadCounterRef.current += 1;
          setSlots((previous) => ({
            ...previous,
            [slotKey]: createMockSlotFile(
              slotKey,
              `https://example.com/${slotKey}-upload-${uploadCounterRef.current}.png`
            ),
          }));
          return true;
        },
        clearSlot: async (slotKey: MockCharacterReferenceSlotKey) => {
          setSlots((previous) => ({
            ...previous,
            [slotKey]: null,
          }));
          return undefined;
        },
        createCharacter: async () => undefined,
        selectCharacter: async (characterId: string) => {
          characterManagerMockState.selectedCharacterId = characterId;
        },
        deleteCharacter: async () => true,
        isSlotBusy: () => false,
        clearMessages: () => undefined,
      };
    },
  };
});

vi.mock("../../hooks/useCharacterQuickSwapDeck", async () => {
  const React = await import("react");

  return {
    useCharacterQuickSwapDeck: () => {
      const [activeItems, setActiveItems] = React.useState<MockQuickSwapItem[]>(() =>
        createInitialQuickSwapItems()
      );
      const [error, setError] = React.useState<string | null>(null);
      const uploadCounterRef = React.useRef(0);

      return {
        activeItems,
        archivedItems: [] as MockQuickSwapItem[],
        archivedCount: 0,
        loading: false,
        loadingArchived: false,
        mutating: false,
        error,
        hasMoreArchived: false,
        appendFiles: async (files: File[]) => {
          uploadCounterRef.current += 1;
          setActiveItems((previous) => [
            ...previous,
            ...files.map((file, index) => ({
              id: `qs-upload-${uploadCounterRef.current}-${index + 1}-${crypto.randomUUID()}`,
              mediaFileId: `media-upload-${uploadCounterRef.current}-${index + 1}`,
              storagePath: `quick/upload-${uploadCounterRef.current}-${index + 1}.png`,
              previewUrl: `https://example.com/upload-${uploadCounterRef.current}-${index + 1}.png`,
              status: "active" as const,
              createdAt: new Date().toISOString(),
              archivedAt: null,
              legacySlotKey: null,
            })),
          ]);
          return true;
        },
        appendExistingMediaReference: async (mediaFileId: string) => {
          if (quickSwapDeckMockState.appendExistingMediaReferenceImpl) {
            return quickSwapDeckMockState.appendExistingMediaReferenceImpl(mediaFileId);
          }
          const trimmedMediaFileId = mediaFileId.trim();
          if (!trimmedMediaFileId) return false;
          setActiveItems((previous) => {
            if (previous.some((item) => item.mediaFileId === trimmedMediaFileId)) {
              return previous;
            }
            const nextIndex = previous.length + 1;
            return [
              ...previous,
              {
                id: `qs-existing-${nextIndex}`,
                mediaFileId: trimmedMediaFileId,
                storagePath: `quick/existing-${nextIndex}.png`,
                previewUrl: `https://example.com/existing-${nextIndex}.png`,
                status: "active" as const,
                createdAt: new Date().toISOString(),
                archivedAt: null,
                legacySlotKey: null,
              },
            ];
          });
          return true;
        },
        removeItem: async (itemId: string) => {
          setActiveItems((previous) => previous.filter((item) => item.id !== itemId));
          return true;
        },
        restoreItem: async () => true,
        loadMoreArchived: async () => undefined,
        refresh: async () => undefined,
        clearError: () => setError(null),
      };
    },
  };
});

describe("CharacterManagerShell behavior", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = TEST_SUPABASE_URL;
    characterManagerMockState.characters = [];
    characterManagerMockState.selectedCharacterId = "character-1";
    supabaseClientMockState.mediaLookupMaybeSingle.mockReset();
    supabaseClientMockState.mediaLookupMaybeSingle.mockResolvedValue({ data: null, error: null });
    supabaseClientMockState.storageDownload.mockReset();
    supabaseClientMockState.storageDownload.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });
    quickSwapDeckMockState.appendExistingMediaReferenceImpl = null;
  });

  afterAll(() => {
    if (ORIGINAL_SUPABASE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      return;
    }
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_SUPABASE_URL;
  });

  it("replaces an assigned Character Sheet zone when a new reference is dropped", async () => {
    render(<CharacterManagerShell />);

    const portraitZone = getCharacterSheetZone("Portrait");
    const firstReferenceCard = getReferenceCard(1);
    const secondReferenceCard = getReferenceCard(2);

    const firstDrag = createDataTransfer();
    fireEvent.dragStart(firstReferenceCard, { dataTransfer: firstDrag });
    fireEvent.dragOver(portraitZone, { dataTransfer: firstDrag });
    fireEvent.drop(portraitZone, { dataTransfer: firstDrag });
    fireEvent.dragEnd(firstReferenceCard, { dataTransfer: firstDrag });

    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBe("https://example.com/front-full-initial.png");
    });

    const secondDrag = createDataTransfer();
    fireEvent.dragStart(secondReferenceCard, { dataTransfer: secondDrag });
    fireEvent.dragOver(portraitZone, { dataTransfer: secondDrag });
    fireEvent.drop(portraitZone, { dataTransfer: secondDrag });
    fireEvent.dragEnd(secondReferenceCard, { dataTransfer: secondDrag });

    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBe("https://example.com/side-profile-initial.png");
    });
  });

  it("swaps zone assignments when dragging from one Character Sheet zone to another", async () => {
    render(<CharacterManagerShell />);

    const portraitZone = getCharacterSheetZone("Portrait");
    const closeUpZone = getCharacterSheetZone("Close-up");
    const firstReferenceCard = getReferenceCard(1);
    const secondReferenceCard = getReferenceCard(2);

    const firstReferenceDrag = createDataTransfer();
    fireEvent.dragStart(firstReferenceCard, { dataTransfer: firstReferenceDrag });
    fireEvent.dragOver(portraitZone, { dataTransfer: firstReferenceDrag });
    fireEvent.drop(portraitZone, { dataTransfer: firstReferenceDrag });
    fireEvent.dragEnd(firstReferenceCard, { dataTransfer: firstReferenceDrag });

    const secondReferenceDrag = createDataTransfer();
    fireEvent.dragStart(secondReferenceCard, { dataTransfer: secondReferenceDrag });
    fireEvent.dragOver(closeUpZone, { dataTransfer: secondReferenceDrag });
    fireEvent.drop(closeUpZone, { dataTransfer: secondReferenceDrag });
    fireEvent.dragEnd(secondReferenceCard, { dataTransfer: secondReferenceDrag });

    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBe("https://example.com/front-full-initial.png");
      expect(getZoneImageSrc("Close-up")).toBe("https://example.com/side-profile-initial.png");
    });

    const zoneToZoneDrag = createDataTransfer();
    fireEvent.dragStart(portraitZone, { dataTransfer: zoneToZoneDrag });
    fireEvent.dragOver(closeUpZone, { dataTransfer: zoneToZoneDrag });
    fireEvent.drop(closeUpZone, { dataTransfer: zoneToZoneDrag });
    fireEvent.dragEnd(portraitZone, { dataTransfer: zoneToZoneDrag });

    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBe("https://example.com/side-profile-initial.png");
      expect(getZoneImageSrc("Close-up")).toBe("https://example.com/front-full-initial.png");
    });
  });

  it("keeps legacy slot-key drop compatibility for Character Sheet assignment", async () => {
    render(<CharacterManagerShell />);

    const portraitZone = getCharacterSheetZone("Portrait");
    const legacySlotDrag = createDataTransfer();
    legacySlotDrag.setData("application/x-shortpulse-reference-slot-key", "front_full");
    legacySlotDrag.setData("text/plain", "front_full");

    fireEvent.dragOver(portraitZone, { dataTransfer: legacySlotDrag });
    fireEvent.drop(portraitZone, { dataTransfer: legacySlotDrag });

    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBe("https://example.com/front-full-initial.png");
    });
  });

  it("defaults to one visible preset tab and shows add-tab control", () => {
    render(<CharacterManagerShell />);

    expect(screen.getByRole("tab", { name: "1" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "2" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add character sheet preset tab" })
    ).toBeInTheDocument();
  });

  it("supports renaming preset tabs with Enter", () => {
    render(<CharacterManagerShell />);

    const tabOne = screen.getByRole("tab", { name: "1" });
    fireEvent.doubleClick(tabOne);
    const renameInput = screen.getByLabelText("Rename preset 1");
    fireEvent.change(renameInput, { target: { value: "Hero Look" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    expect(screen.getByRole("tab", { name: "Hero Look" })).toBeInTheDocument();
  });

  it("shows delete confirmation with target preset label and respects No cancel", async () => {
    render(<CharacterManagerShell />);
    const addButton = screen.getByRole("button", { name: "Add character sheet preset tab" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    expect(screen.queryByRole("button", { name: "Delete preset 1" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete preset 2" }));

    expect(screen.getByText("Delete preset “2”?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This removes saved references from this preset tab. Do you wish to continue?"
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "No" }));
    await waitFor(() => {
      expect(screen.queryByText("Delete preset “2”?")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "2" })).toBeInTheDocument();
  });

  it("deletes active tab with nearest-left fallback and preserves active tab on non-active delete", async () => {
    render(<CharacterManagerShell />);
    const addButton = screen.getByRole("button", { name: "Add character sheet preset tab" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    fireEvent.click(screen.getByRole("tab", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete preset 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: "2" })).not.toBeInTheDocument();
    });
    const tabPanelAfterActiveDelete = screen.getByRole("tabpanel");
    const tabOne = screen.getByRole("tab", { name: "1" });
    expect(tabOne).toHaveAttribute("aria-selected", "true");
    expect(tabPanelAfterActiveDelete).toHaveAttribute("aria-labelledby", tabOne.id);

    fireEvent.click(screen.getByRole("button", { name: "Add character sheet preset tab" }));
    fireEvent.click(screen.getByRole("tab", { name: "3" }));
    expect(screen.getByRole("tab", { name: "3" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "Delete preset 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: "2" })).not.toBeInTheDocument();
    });
    const tabThreeAfterNonActiveDelete = screen.getByRole("tab", { name: "3" });
    const tabPanelAfterNonActiveDelete = screen.getByRole("tabpanel");
    expect(tabThreeAfterNonActiveDelete).toHaveAttribute("aria-selected", "true");
    expect(tabPanelAfterNonActiveDelete).toHaveAttribute(
      "aria-labelledby",
      tabThreeAfterNonActiveDelete.id
    );

    expect(screen.getByRole("tab", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "3" })).toBeInTheDocument();
  });

  it("applies roving tabindex semantics and tabpanel linkage for preset tabs", async () => {
    render(<CharacterManagerShell />);
    const addButton = screen.getByRole("button", { name: "Add character sheet preset tab" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "3" })).toBeInTheDocument();
    });

    const tabOne = screen.getByRole("tab", { name: "1" });
    const tabThree = screen.getByRole("tab", { name: "3" });
    const panel = screen.getByRole("tabpanel");

    // Add-tab activates the newly created tab.
    expect(tabThree).toHaveAttribute("aria-selected", "true");
    expect(tabThree).toHaveAttribute("tabindex", "0");
    expect(tabOne).toHaveAttribute("aria-selected", "false");
    expect(tabOne).toHaveAttribute("tabindex", "-1");
    expect(panel).toHaveAttribute("aria-labelledby", tabThree.id);

    fireEvent.click(tabOne);

    await waitFor(() => {
      expect(tabOne).toHaveAttribute("aria-selected", "true");
      expect(tabOne).toHaveAttribute("tabindex", "0");
      expect(tabThree).toHaveAttribute("tabindex", "-1");
      expect(panel).toHaveAttribute("aria-labelledby", tabOne.id);
    });
  });

  it("supports keyboard navigation for preset tabs including wrap, Home/End, Enter, and Space", async () => {
    render(<CharacterManagerShell />);
    const addButton = screen.getByRole("button", { name: "Add character sheet preset tab" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const tabOne = screen.getByRole("tab", { name: "1" });
    const tabTwo = screen.getByRole("tab", { name: "2" });
    const tabThree = screen.getByRole("tab", { name: "3" });
    const tabFour = screen.getByRole("tab", { name: "4" });

    fireEvent.keyDown(tabOne, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(tabFour).toHaveAttribute("aria-selected", "true");
    });
    expect(document.activeElement).toBe(tabFour);

    fireEvent.keyDown(tabFour, { key: "ArrowRight" });
    await waitFor(() => {
      expect(tabOne).toHaveAttribute("aria-selected", "true");
    });
    expect(document.activeElement).toBe(tabOne);

    fireEvent.keyDown(tabOne, { key: "End" });
    await waitFor(() => {
      expect(tabFour).toHaveAttribute("aria-selected", "true");
    });

    fireEvent.keyDown(tabFour, { key: "Home" });
    await waitFor(() => {
      expect(tabOne).toHaveAttribute("aria-selected", "true");
    });

    fireEvent.keyDown(tabOne, { key: "ArrowRight" });
    await waitFor(() => {
      expect(tabTwo).toHaveAttribute("aria-selected", "true");
    });
    fireEvent.keyDown(tabTwo, { key: " " });
    await waitFor(() => {
      expect(tabTwo).toHaveAttribute("aria-selected", "true");
    });

    fireEvent.keyDown(tabTwo, { key: "ArrowRight" });
    await waitFor(() => {
      expect(tabThree).toHaveAttribute("aria-selected", "true");
    });
    fireEvent.keyDown(tabThree, { key: "Enter" });
    await waitFor(() => {
      expect(tabThree).toHaveAttribute("aria-selected", "true");
    });
  });

  it("isolates character sheet assignments per active preset tab", async () => {
    render(<CharacterManagerShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add character sheet preset tab" }));
    fireEvent.click(screen.getByRole("tab", { name: "1" }));

    const portraitZone = getCharacterSheetZone("Portrait");
    const firstReferenceCard = getReferenceCard(1);
    const secondReferenceCard = getReferenceCard(2);

    const presetOneDrag = createDataTransfer();
    fireEvent.dragStart(firstReferenceCard, { dataTransfer: presetOneDrag });
    fireEvent.dragOver(portraitZone, { dataTransfer: presetOneDrag });
    fireEvent.drop(portraitZone, { dataTransfer: presetOneDrag });
    fireEvent.dragEnd(firstReferenceCard, { dataTransfer: presetOneDrag });

    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBe("https://example.com/front-full-initial.png");
    });

    fireEvent.click(screen.getByRole("tab", { name: "2" }));

    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBeNull();
    });

    const presetTwoDrag = createDataTransfer();
    fireEvent.dragStart(secondReferenceCard, { dataTransfer: presetTwoDrag });
    fireEvent.dragOver(portraitZone, { dataTransfer: presetTwoDrag });
    fireEvent.drop(portraitZone, { dataTransfer: presetTwoDrag });
    fireEvent.dragEnd(secondReferenceCard, { dataTransfer: presetTwoDrag });

    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBe("https://example.com/side-profile-initial.png");
    });

    fireEvent.click(screen.getByRole("tab", { name: "1" }));

    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBe("https://example.com/front-full-initial.png");
    });
  });

  it("keeps preset assignments after removing the original quickswap reference", async () => {
    render(<CharacterManagerShell />);

    const portraitZone = getCharacterSheetZone("Portrait");
    const firstReferenceCard = getReferenceCard(1);

    const assignDrag = createDataTransfer();
    fireEvent.dragStart(firstReferenceCard, { dataTransfer: assignDrag });
    fireEvent.dragOver(portraitZone, { dataTransfer: assignDrag });
    fireEvent.drop(portraitZone, { dataTransfer: assignDrag });
    fireEvent.dragEnd(firstReferenceCard, { dataTransfer: assignDrag });

    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBe("https://example.com/front-full-initial.png");
    });

    clickRemoveReference(1);
    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBe("https://example.com/front-full-initial.png");
    });

    const file = new File(["front-full"], "front-full.png", { type: "image/png" });
    const referenceUploadGrid = screen.getByRole("list", {
      name: /Uploaded references/i,
    });
    fireEvent.drop(referenceUploadGrid, {
      dataTransfer: createDataTransfer([file]),
    });

    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBe("https://example.com/front-full-initial.png");
    });
  });

  it("supports uploading beyond ten quickswap references", async () => {
    render(<CharacterManagerShell />);

    const referenceUploadGrid = screen.getByRole("list", {
      name: /Uploaded references/i,
    });
    const files = Array.from(
      { length: 12 },
      (_, index) => new File([`file-${index + 1}`], `file-${index + 1}.png`, { type: "image/png" })
    );
    fireEvent.drop(referenceUploadGrid, {
      dataTransfer: createDataTransfer(files),
    });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Remove reference/i })).toHaveLength(14);
    });
  });

  it("uploads into quickswap from file picker", async () => {
    render(<CharacterManagerShell />);

    const uploadButton = screen.getByRole("button", {
      name: /Upload quick swap reference image/i,
    });
    fireEvent.click(uploadButton);

    const simpleUploadInput = document.querySelector(
      'input[type="file"][accept="image/*"][multiple]'
    ) as HTMLInputElement | null;
    if (!simpleUploadInput) {
      throw new Error("Unable to locate simple reference upload input.");
    }

    const uploadFile = new File(["top-down"], "top-down.png", { type: "image/png" });
    fireEvent.change(simpleUploadInput, { target: { files: [uploadFile] } });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Remove reference/i })).toHaveLength(3);
    });
  });

  it("uploads a preset-zone file without consuming quickswap deck capacity", async () => {
    render(<CharacterManagerShell />);

    const referenceUploadGrid = screen.getByRole("list", {
      name: /Uploaded references/i,
    });
    const files = Array.from(
      { length: 12 },
      (_, index) => new File([`file-${index + 1}`], `file-${index + 1}.png`, { type: "image/png" })
    );
    fireEvent.drop(referenceUploadGrid, {
      dataTransfer: createDataTransfer(files),
    });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Remove reference/i })).toHaveLength(14);
    });

    fireEvent.click(getCharacterSheetZone("Action or Expression"));

    const characterSheetUploadInput = screen.getByTestId(
      "character-sheet-upload-input"
    ) as HTMLInputElement;
    fireEvent.change(characterSheetUploadInput, {
      target: { files: [new File(["preset"], "preset.png", { type: "image/png" })] },
    });

    await waitFor(() => {
      expect(getZoneImageSrc("Action or Expression")).toBe(
        "https://example.com/preset-1-back_shot-1.png"
      );
      expect(screen.getAllByRole("button", { name: /Remove reference/i })).toHaveLength(14);
    });
  });

  it("accepts a dragged reference-grid image into a Character Sheet zone", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["portrait"], { type: "image/png" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      render(<CharacterManagerShell />);

      const portraitZone = getCharacterSheetZone("Portrait");
      const externalDrag = createDataTransfer();
      externalDrag.setData(
        "text/reference-url",
        `${TEST_SUPABASE_URL}/storage/v1/object/sign/media_library/user-1/reference-grid-image.png?token=abc`
      );

      fireEvent.dragOver(portraitZone, { dataTransfer: externalDrag });
      fireEvent.drop(portraitZone, { dataTransfer: externalDrag });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          `${TEST_SUPABASE_URL}/storage/v1/object/sign/media_library/user-1/reference-grid-image.png?token=abc`
        );
        expect(getZoneImageSrc("Portrait")).toBe("https://example.com/preset-1-portrait-1.png");
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("accepts an internal reference-grid drop into a Character Sheet zone from an unallowlisted host", async () => {
    const resolveCharacterDropReference = vi.fn(async () => ({
      mediaId: "media-internal-portrait-1",
      previewUrl: "https://example.com/unallowlisted-character-sheet.png",
      outputId: "output-internal-portrait-1",
      imageIndex: 0,
      sourceSurface: "all-refs" as const,
    }));
    supabaseClientMockState.mediaLookupMaybeSingle.mockResolvedValueOnce({
      data: {
        storage_path: "user-1/library/internal-portrait.png",
      },
      error: null,
    });

    render(
      <CharacterManagerShell
        resolveCharacterDropReference={resolveCharacterDropReference}
        surface="panel"
      />
    );

    const portraitZone = getCharacterSheetZone("Portrait");
    const internalDrag = createDataTransfer();
    addInternalReferenceDragPayload(internalDrag, {
      outputId: "output-internal-portrait-1",
      mediaId: "media-internal-portrait-1",
      sourceSurface: "all-refs",
      referenceUrl: "https://example.com/unallowlisted-character-sheet.png",
    });
    internalDrag.setData(
      "text/reference-url",
      "https://example.com/unallowlisted-character-sheet.png"
    );

    fireEvent.dragOver(portraitZone, { dataTransfer: internalDrag });
    fireEvent.drop(portraitZone, { dataTransfer: internalDrag });

    await waitFor(() => {
      expect(resolveCharacterDropReference).toHaveBeenCalled();
      expect(getZoneImageSrc("Portrait")).toBe(
        "https://example.com/unallowlisted-character-sheet.png"
      );
    });
  });

  it("accepts an internal reference-grid drop without media id into a Character Sheet zone", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["internal-no-media"], { type: "image/png" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const resolveCharacterDropReference = vi.fn(async () => ({
      mediaId: "",
      previewUrl: "https://example.com/internal-no-media-character-sheet.png",
      outputId: "output-internal-no-media-portrait-1",
      imageIndex: 0,
      sourceSurface: "all-refs" as const,
    }));

    try {
      render(
        <CharacterManagerShell
          resolveCharacterDropReference={resolveCharacterDropReference}
          surface="panel"
        />
      );

      const portraitZone = getCharacterSheetZone("Portrait");
      const internalDrag = createDataTransfer();
      addInternalReferenceDragPayload(internalDrag, {
        outputId: "output-internal-no-media-portrait-1",
        sourceSurface: "all-refs",
        referenceUrl: "https://example.com/internal-no-media-character-sheet.png",
      });

      fireEvent.dragOver(portraitZone, { dataTransfer: internalDrag });
      fireEvent.drop(portraitZone, { dataTransfer: internalDrag });

      await waitFor(() => {
        expect(resolveCharacterDropReference).toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledWith(
          "https://example.com/internal-no-media-character-sheet.png"
        );
        expect(getZoneImageSrc("Portrait")).toBe("https://example.com/preset-1-portrait-1.png");
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("accepts a dragged reference-grid image into the QuickSwap deck", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["top-down"], { type: "image/png" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      render(<CharacterManagerShell />);

      const quickSwapSection = screen.getByText("QuickSwap Deck").closest("section");
      if (!quickSwapSection) {
        throw new Error("Unable to resolve QuickSwap deck section.");
      }
      const externalDrag = createDataTransfer();
      externalDrag.setData(
        "text/reference-url",
        `${TEST_SUPABASE_URL}/storage/v1/object/sign/media_library/user-1/reference-grid-quickswap.png?token=abc`
      );

      fireEvent.dragEnter(quickSwapSection, { dataTransfer: externalDrag });
      fireEvent.dragOver(quickSwapSection, { dataTransfer: externalDrag });
      fireEvent.drop(quickSwapSection, { dataTransfer: externalDrag });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          `${TEST_SUPABASE_URL}/storage/v1/object/sign/media_library/user-1/reference-grid-quickswap.png?token=abc`
        );
        expect(screen.getAllByRole("button", { name: /Remove reference/i })).toHaveLength(3);
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("accepts an internal reference-grid drop into QuickSwap even when URL host is unallowlisted", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["internal"], { type: "image/png" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const resolveCharacterDropReference = vi.fn(async () => ({
      mediaId: "media-internal-quickswap-1",
      previewUrl: "https://example.com/unallowlisted-quickswap.png",
      outputId: "output-internal-quickswap-1",
      imageIndex: 0,
      sourceSurface: "all-refs" as const,
    }));

    try {
      render(
        <CharacterManagerShell
          resolveCharacterDropReference={resolveCharacterDropReference}
          surface="panel"
        />
      );

      const quickSwapSection = screen.getByText("QuickSwap Deck").closest("section");
      if (!quickSwapSection) {
        throw new Error("Unable to resolve QuickSwap deck section.");
      }
      const internalDrag = createDataTransfer();
      addInternalReferenceDragPayload(internalDrag, {
        outputId: "output-internal-quickswap-1",
        mediaId: "media-internal-quickswap-1",
        sourceSurface: "all-refs",
        referenceUrl: "https://example.com/unallowlisted-quickswap.png",
      });
      internalDrag.setData("text/reference-url", "https://example.com/unallowlisted-quickswap.png");

      fireEvent.dragEnter(quickSwapSection, { dataTransfer: internalDrag });
      fireEvent.dragOver(quickSwapSection, { dataTransfer: internalDrag });
      fireEvent.drop(quickSwapSection, { dataTransfer: internalDrag });

      await waitFor(() => {
        expect(resolveCharacterDropReference).toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getAllByRole("button", { name: /Remove reference/i })).toHaveLength(3);
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to URL upload when internal QuickSwap media attach fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["internal-fallback"], { type: "image/png" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    quickSwapDeckMockState.appendExistingMediaReferenceImpl = vi.fn(async () => false);
    const resolveCharacterDropReference = vi.fn(async () => ({
      mediaId: "media-internal-fallback-1",
      previewUrl: "https://example.com/internal-fallback-quickswap.png",
      outputId: "output-internal-fallback-1",
      imageIndex: 0,
      sourceSurface: "all-refs" as const,
    }));

    try {
      render(
        <CharacterManagerShell
          resolveCharacterDropReference={resolveCharacterDropReference}
          surface="panel"
        />
      );

      const quickSwapSection = screen.getByText("QuickSwap Deck").closest("section");
      if (!quickSwapSection) {
        throw new Error("Unable to resolve QuickSwap deck section.");
      }
      const internalDrag = createDataTransfer();
      addInternalReferenceDragPayload(internalDrag, {
        outputId: "output-internal-fallback-1",
        mediaId: "media-internal-fallback-1",
        sourceSurface: "all-refs",
        referenceUrl: "https://example.com/internal-fallback-quickswap.png",
      });
      internalDrag.setData(
        "text/reference-url",
        "https://example.com/internal-fallback-quickswap.png"
      );

      fireEvent.dragEnter(quickSwapSection, { dataTransfer: internalDrag });
      fireEvent.dragOver(quickSwapSection, { dataTransfer: internalDrag });
      fireEvent.drop(quickSwapSection, { dataTransfer: internalDrag });

      await waitFor(() => {
        expect(resolveCharacterDropReference).toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledWith(
          "https://example.com/internal-fallback-quickswap.png"
        );
        expect(screen.getAllByRole("button", { name: /Remove reference/i })).toHaveLength(3);
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("accepts an internal reference-grid drop into QuickSwap without media id", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["internal-no-media"], { type: "image/png" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const resolveCharacterDropReference = vi.fn(async () => ({
      mediaId: "",
      previewUrl: "https://example.com/internal-no-media-quickswap.png",
      outputId: "output-internal-no-media-quickswap-1",
      imageIndex: 0,
      sourceSurface: "all-refs" as const,
    }));

    try {
      render(
        <CharacterManagerShell
          resolveCharacterDropReference={resolveCharacterDropReference}
          surface="panel"
        />
      );

      const quickSwapSection = screen.getByText("QuickSwap Deck").closest("section");
      if (!quickSwapSection) {
        throw new Error("Unable to resolve QuickSwap deck section.");
      }
      const internalDrag = createDataTransfer();
      addInternalReferenceDragPayload(internalDrag, {
        outputId: "output-internal-no-media-quickswap-1",
        sourceSurface: "all-refs",
        referenceUrl: "https://example.com/internal-no-media-quickswap.png",
      });

      fireEvent.dragEnter(quickSwapSection, { dataTransfer: internalDrag });
      fireEvent.dragOver(quickSwapSection, { dataTransfer: internalDrag });
      fireEvent.drop(quickSwapSection, { dataTransfer: internalDrag });

      await waitFor(() => {
        expect(resolveCharacterDropReference).toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledWith(
          "https://example.com/internal-no-media-quickswap.png"
        );
        expect(screen.getAllByRole("button", { name: /Remove reference/i })).toHaveLength(3);
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows a pending QuickSwap overlay state while internal drop attachment is in flight", async () => {
    let resolveAppend: ((value: boolean) => void) | null = null;
    quickSwapDeckMockState.appendExistingMediaReferenceImpl = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveAppend = resolve;
        })
    );
    const resolveCharacterDropReference = vi.fn(async () => ({
      mediaId: "media-internal-pending-1",
      previewUrl: "https://example.com/unallowlisted-pending.png",
      outputId: "output-internal-pending-1",
      imageIndex: 0,
      sourceSurface: "all-refs" as const,
    }));

    render(
      <CharacterManagerShell
        resolveCharacterDropReference={resolveCharacterDropReference}
        surface="panel"
      />
    );

    const quickSwapSection = screen.getByText("QuickSwap Deck").closest("section");
    if (!quickSwapSection) {
      throw new Error("Unable to resolve QuickSwap deck section.");
    }
    const internalDrag = createDataTransfer();
    addInternalReferenceDragPayload(internalDrag, {
      outputId: "output-internal-pending-1",
      mediaId: "media-internal-pending-1",
      sourceSurface: "all-refs",
      referenceUrl: "https://example.com/unallowlisted-pending.png",
    });

    fireEvent.dragEnter(quickSwapSection, { dataTransfer: internalDrag });
    fireEvent.dragOver(quickSwapSection, { dataTransfer: internalDrag });
    fireEvent.drop(quickSwapSection, { dataTransfer: internalDrag });

    await waitFor(() => {
      expect(screen.getByText("Adding image to QuickSwap Deck...")).toBeInTheDocument();
      expect(
        screen.getByText("Processing drop and syncing your QuickSwap Deck.")
      ).toBeInTheDocument();
    });

    resolveAppend?.(true);
    await waitFor(() => {
      expect(screen.queryByText("Adding image to QuickSwap Deck...")).not.toBeInTheDocument();
    });
  });

  it("fails closed when internal reference-grid drop resolution cannot produce a media id", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["internal"], { type: "image/png" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const resolveCharacterDropReference = vi.fn(async () => null);

    try {
      render(
        <CharacterManagerShell
          resolveCharacterDropReference={resolveCharacterDropReference}
          surface="panel"
        />
      );

      const portraitZone = getCharacterSheetZone("Portrait");
      const internalDrag = createDataTransfer();
      addInternalReferenceDragPayload(internalDrag, {
        outputId: "output-internal-rejected-1",
        sourceSurface: "all-refs",
        referenceUrl: "https://example.com/unallowlisted-rejected.png",
      });
      internalDrag.setData("text/reference-url", "https://example.com/unallowlisted-rejected.png");

      fireEvent.dragOver(portraitZone, { dataTransfer: internalDrag });
      fireEvent.drop(portraitZone, { dataTransfer: internalDrag });

      await waitFor(() => {
        expect(resolveCharacterDropReference).toHaveBeenCalled();
        expect(getZoneImageSrc("Portrait")).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("blocks an untrusted external dropped URL from entering the QuickSwap deck", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["top-down"], { type: "image/png" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      render(<CharacterManagerShell />);

      const quickSwapSection = screen.getByText("QuickSwap Deck").closest("section");
      if (!quickSwapSection) {
        throw new Error("Unable to resolve QuickSwap deck section.");
      }
      const externalDrag = createDataTransfer();
      externalDrag.setData("text/reference-url", "https://example.com/untrusted-reference.png");

      fireEvent.dragEnter(quickSwapSection, { dataTransfer: externalDrag });
      fireEvent.dragOver(quickSwapSection, { dataTransfer: externalDrag });
      fireEvent.drop(quickSwapSection, { dataTransfer: externalDrag });

      await waitFor(() => {
        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getAllByRole("button", { name: /Remove reference/i })).toHaveLength(2);
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to media storage download when dropped reference URL fetch fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);
    supabaseClientMockState.mediaLookupMaybeSingle.mockResolvedValueOnce({
      data: {
        storage_path: "private/user-1/references/reference-grid-quickswap.png",
      },
      error: null,
    });
    supabaseClientMockState.storageDownload.mockResolvedValueOnce({
      data: new Blob(["fallback-image"], { type: "image/png" }),
      error: null,
    });

    try {
      render(<CharacterManagerShell />);

      const quickSwapSection = screen.getByText("QuickSwap Deck").closest("section");
      if (!quickSwapSection) {
        throw new Error("Unable to resolve QuickSwap deck section.");
      }
      const externalDrag = createDataTransfer();
      externalDrag.setData(
        "text/reference-url",
        `${TEST_SUPABASE_URL}/storage/v1/object/sign/media_library/user-1/expired-signed-url.png?token=expired`
      );
      externalDrag.setData("text/reference-media-id", "media-file-id-1");

      fireEvent.dragEnter(quickSwapSection, { dataTransfer: externalDrag });
      fireEvent.dragOver(quickSwapSection, { dataTransfer: externalDrag });
      fireEvent.drop(quickSwapSection, { dataTransfer: externalDrag });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          `${TEST_SUPABASE_URL}/storage/v1/object/sign/media_library/user-1/expired-signed-url.png?token=expired`
        );
        expect(supabaseClientMockState.mediaLookupMaybeSingle).toHaveBeenCalled();
        expect(supabaseClientMockState.storageDownload).toHaveBeenCalledWith(
          "private/user-1/references/reference-grid-quickswap.png"
        );
        expect(screen.getAllByRole("button", { name: /Remove reference/i })).toHaveLength(3);
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("collapses and expands the QuickSwap deck content", async () => {
    render(<CharacterManagerShell />);
    const quickSwapHelperCopy =
      "The quick swap deck is a small library of images you can quickly access to swap out your character's style on the fly.";

    expect(
      screen.getByRole("button", {
        name: /Collapse QuickSwap Deck/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(quickSwapHelperCopy)).toBeInTheDocument();
    expect(
      screen.getByRole("list", {
        name: /Uploaded references/i,
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Collapse QuickSwap Deck/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Expand QuickSwap Deck/i,
        })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("list", {
          name: /Uploaded references/i,
        })
      ).not.toBeInTheDocument();
      expect(screen.queryByText(quickSwapHelperCopy)).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Expand QuickSwap Deck/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Collapse QuickSwap Deck/i,
        })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("list", {
          name: /Uploaded references/i,
        })
      ).toBeInTheDocument();
      expect(screen.getByText(quickSwapHelperCopy)).toBeInTheDocument();
    });
  });

  it("hides the QuickSwap collapse control in panel expert mode", () => {
    render(<CharacterManagerShell surface="panel" beginnerModeOverride={false} />);

    expect(
      screen.queryByRole("button", {
        name: /Collapse QuickSwap Deck/i,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Expand QuickSwap Deck/i,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("list", {
        name: /Uploaded references/i,
      })
    ).toBeInTheDocument();
  });

  it("loads full-quality signed media for the reference preview overlay", async () => {
    render(<CharacterManagerShell />);

    const previewTargets = document.querySelectorAll(".character-reference-upload-image-wrap");
    expect(previewTargets.length).toBeGreaterThan(0);

    fireEvent.doubleClick(previewTargets[0]!);

    await waitFor(() => {
      const previewImage = document.querySelector(".character-reference-preview-image");
      expect(previewImage).toBeTruthy();
      expect(previewImage?.getAttribute("src")).toBe(
        "https://example.com/full-quality/quick/front-full.png"
      );
    });
  });

  it("shows Create New Character only in Manage Characters tab", async () => {
    render(<CharacterManagerShell />);

    expect(
      screen.queryByRole("button", {
        name: /Create New Character/i,
      })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Disable beginner mode/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Manage Characters/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Create New Character/i,
        })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: /Disable beginner mode|Enable beginner mode/i,
        })
      ).not.toBeInTheDocument();
    });
  });

  it("hides beginner toggle controls when `showBeginnerModeToggle` is false", () => {
    render(<CharacterManagerShell showBeginnerModeToggle={false} />);

    expect(
      screen.queryByRole("button", {
        name: /Disable beginner mode|Enable beginner mode/i,
      })
    ).not.toBeInTheDocument();
  });

  it("progressively reveals large character libraries in Manage mode", async () => {
    characterManagerMockState.characters = Array.from({ length: 100 }, (_, index) => ({
      characterId: `character-${index + 1}`,
      characterName: `Character ${index + 1}`,
      profileImageUrl: null,
      profileImageTransform: null,
    }));
    characterManagerMockState.selectedCharacterId = "character-1";

    render(<CharacterManagerShell />);

    fireEvent.click(screen.getByRole("tab", { name: /Manage Characters/i }));

    const characterList = screen.getByRole("list", { name: /Character list/i });
    await waitFor(() => {
      expect(within(characterList).getAllByRole("listitem")).toHaveLength(50);
    });
    expect(screen.getByText("Showing 50 of 100 characters.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Show 25 more/i }));
    await waitFor(() => {
      expect(within(characterList).getAllByRole("listitem")).toHaveLength(75);
    });
    expect(screen.getByText("Showing 75 of 100 characters.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Show all/i }));
    await waitFor(() => {
      expect(within(characterList).getAllByRole("listitem")).toHaveLength(100);
    });
  });

  it("keeps helper text and tips visible in expert mode while hiding numbered badges", async () => {
    render(<CharacterManagerShell />);

    expect(document.querySelectorAll(".character-step-badge")).toHaveLength(2);
    expect(
      screen.getByText(
        "The quick swap deck is a small library of images you can quickly access to swap out your character's style on the fly."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Drag or upload references into each slot. These images are used to train your character generations."
      )
    ).toBeInTheDocument();
    expect(document.querySelector(".character-mode-guidance")).toBeInTheDocument();
    expect(document.querySelector(".character-mode-guidance")).toHaveTextContent(
      /Swap out your character's style on the fly by dragging and dropping references from the QuickSwap Deck\./i
    );
    expect(
      screen.getByText("Tip: Character description will be used as part of consistency generation.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Disable beginner mode/i }));

    await waitFor(() => {
      expect(document.querySelectorAll(".character-step-badge")).toHaveLength(0);
      expect(
        screen.getByText(
          "The quick swap deck is a small library of images you can quickly access to swap out your character's style on the fly."
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Drag or upload references into each slot. These images are used to train your character generations."
        )
      ).toBeInTheDocument();
      expect(document.querySelector(".character-mode-guidance")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Tip: Character description will be used as part of consistency generation."
        )
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Enable beginner mode/i }));

    await waitFor(() => {
      expect(document.querySelectorAll(".character-step-badge")).toHaveLength(2);
      expect(
        screen.getByText(
          "The quick swap deck is a small library of images you can quickly access to swap out your character's style on the fly."
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Drag or upload references into each slot. These images are used to train your character generations."
        )
      ).toBeInTheDocument();
      expect(document.querySelector(".character-mode-guidance")).toBeInTheDocument();
      expect(document.querySelector(".character-mode-guidance")).toHaveTextContent(
        /Swap out your character's style on the fly by dragging and dropping references from the QuickSwap Deck\./i
      );
      expect(
        screen.getByText(
          "Tip: Character description will be used as part of consistency generation."
        )
      ).toBeInTheDocument();
    });
  });
});
