import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterPanelWorkspace } from "../CharacterPanelWorkspace";
import {
  CHARACTER_SHEET_PRESET_IDS,
  createDefaultCharacterSheetPresetState,
  createEmptyCharacterSheetAssignments,
  createEmptyCharacterSheetPresetAssignments,
  getDefaultCharacterSheetPresetTabLabel,
} from "../../constants";

const setCharacterSheetPresetFileMock = vi.fn();

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element -- Test shim for next/image.
  default: (props: Record<string, unknown>) => <img alt="" {...props} />,
}));

vi.mock("../../hooks/useCharacterManagerDraft", () => ({
  useCharacterManagerDraft: () => ({
    characters: [
      {
        characterId: "character-1",
        characterName: "Taylor",
        updatedAt: "2026-05-16T00:00:00.000Z",
        characterStatus: "draft",
        characterSheetId: "sheet-1",
        profileImageUrl: null,
        profileImageTransform: null,
        profileImageStoragePath: null,
        profileImagePreviewStoragePath: null,
        characterSheetStatus: "ready",
      },
    ],
    selectedCharacterId: "character-1",
    characterName: "Taylor",
    characterDescription: "",
    characterSheetAssignments: createEmptyCharacterSheetAssignments(),
    activeCharacterSheetPresetId: "1",
    characterSheetPresets: createDefaultCharacterSheetPresetState().presets,
    visibleCharacterSheetPresetIds: ["1"],
    characterSheetPresetLabels: Object.fromEntries(
      CHARACTER_SHEET_PRESET_IDS.map((presetId) => [
        presetId,
        getDefaultCharacterSheetPresetTabLabel(presetId),
      ])
    ),
    characterSheetPresetAssignments: createEmptyCharacterSheetPresetAssignments(),
    error: null,
    loading: false,
    isSavingName: false,
    isCreatingCharacter: false,
    isSavingCharacter: false,
    isDeletingCharacter: false,
    isSwitchingCharacter: false,
    isSavingCharacterSheetPreset: false,
    hasUnsavedCharacterDraft: false,
    setCharacterName: () => undefined,
    setCharacterDescription: () => undefined,
    setActiveCharacterSheetPreset: async () => true,
    saveCharacterSheetPresetAssignments: async () => true,
    addCharacterSheetPreset: async () => true,
    renameCharacterSheetPreset: async () => true,
    deleteCharacterSheetPreset: async () => true,
    setCharacterSheetPresetFile: setCharacterSheetPresetFileMock,
    createCharacter: async () => undefined,
    saveCharacter: async () => true,
    selectCharacter: async () => undefined,
    deleteCharacter: async () => true,
    clearMessages: () => undefined,
    setErrorMessage: () => undefined,
  }),
}));

vi.mock("../../hooks/useCharacterManagerDroppedReferenceController", () => ({
  useCharacterManagerDroppedReferenceController: () => ({
    pendingDropTarget: null,
    isDropResolutionBusy: false,
    handleCharacterSheetReferenceDrop: async () => undefined,
  }),
}));

vi.mock("../../hooks/useCharacterManagerCharacterSheetInteractions", () => ({
  useCharacterManagerCharacterSheetInteractions: () => ({
    handleCharacterSheetFileSelection: () => undefined,
    handleCharacterSheetDragOver: () => () => undefined,
    clearCharacterSheetAssignment: async () => undefined,
    handleCharacterSheetDrop: () => () => undefined,
  }),
}));

vi.mock("../../hooks/useCharacterManagerDragInteractions", () => ({
  useCharacterManagerDragInteractions: () => ({
    handleCharacterSheetDragStart: () => () => undefined,
    handleReferenceDragEnd: () => undefined,
  }),
}));

vi.mock("../../hooks/useCharacterCardPreviewUrls", () => ({
  useCharacterCardPreviewUrls: () => ({
    refreshCardPreviewSignedUrl: () => undefined,
    resolveCharacterCardPreviewUrl: ({ previewUrl }: { previewUrl?: string | null }) =>
      previewUrl ?? null,
  }),
}));

vi.mock("../../../../components/ConfirmationModal", () => ({
  ConfirmationModal: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe("CharacterPanelWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCharacterSheetPresetFileMock.mockResolvedValue(true);
  });

  it("renders the new library/profile layout without QuickSwap shell copy", () => {
    render(<CharacterPanelWorkspace />);

    expect(screen.getByRole("heading", { name: "Characters Library" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Character Profile" })).toBeInTheDocument();
    expect(screen.queryByText("QuickSwap Deck")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage Characters")).not.toBeInTheDocument();
  });

  it("assigns media-library selections to the armed slot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => new Blob(["image"], { type: "image/png" }),
      })
    );

    const { rerender } = render(<CharacterPanelWorkspace />);
    const portraitCard = screen.getByText("Portrait").closest("article");
    expect(portraitCard).not.toBeNull();
    fireEvent.click(portraitCard!);

    rerender(
      <CharacterPanelWorkspace
        pendingMediaSelection={{
          key: 1,
          payload: {
            id: "media-1",
            url: "https://example.com/ref.png",
            fullUrl: "https://example.com/ref.png",
            fileType: "image",
            filename: "ref.png",
          },
        }}
      />
    );

    await waitFor(() => {
      expect(setCharacterSheetPresetFileMock).toHaveBeenCalledTimes(1);
    });
    expect(setCharacterSheetPresetFileMock).toHaveBeenCalledWith(
      "portrait",
      expect.objectContaining({
        name: "ref.png",
        type: "image/png",
      })
    );
  });
});
