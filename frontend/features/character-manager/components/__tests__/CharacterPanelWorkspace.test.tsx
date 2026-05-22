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
const setErrorMessageMock = vi.fn();
const handleCharacterSheetCardClickMock = vi.fn();

const createDraftState = () => ({
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
  activeCharacterSheetPresetId: "1" as const,
  characterSheetPresets: createDefaultCharacterSheetPresetState().presets,
  visibleCharacterSheetPresetIds: createDefaultCharacterSheetPresetState().tabOrder,
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
  setErrorMessage: setErrorMessageMock,
});

let currentDraftState = createDraftState();

vi.mock("next/image", () => ({
  default: ({ unoptimized, ...props }: Record<string, unknown>) => {
    void unoptimized;
    // eslint-disable-next-line @next/next/no-img-element -- Test shim for next/image.
    return <img alt="" {...props} />;
  },
}));

vi.mock("../../hooks/useCharacterManagerDraft", () => ({
  useCharacterManagerDraft: () => currentDraftState,
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
    handleCharacterSheetCardClick: () => handleCharacterSheetCardClickMock,
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
    currentDraftState = createDraftState();
    setCharacterSheetPresetFileMock.mockResolvedValue(true);
    handleCharacterSheetCardClickMock.mockReset();
  });

  it("renders the new library/profile layout without QuickSwap shell copy", () => {
    render(<CharacterPanelWorkspace />);

    expect(screen.queryByRole("heading", { name: "Characters" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Characters Library" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Character Profile" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Characters" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Description:" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Saved characters" })).not.toBeInTheDocument();
    expect(screen.queryByText("No saved characters yet.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Create a character to start building your library.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Open Characters to browse saved profiles and load one into the editor.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Build the active look and assign references from the media library below."
      )
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Click a slot, then click media below to assign it.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Drag media into a slot or arm a slot and click media below to assign it.")
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Slot armed/i)).not.toBeInTheDocument();
    expect(screen.queryByText("QuickSwap Deck")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage Characters")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Tip: Character description will be used as part of consistency generation."
      )
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /upload portrait reference/i })
    ).not.toBeInTheDocument();
  });

  it("opens the saved character grid inside the Characters modal", () => {
    render(<CharacterPanelWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Characters" }));

    expect(screen.getByRole("dialog", { name: "Character library" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Saved characters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selected Taylor" })).toBeInTheDocument();
  });

  it("opens the direct slot picker when an empty reference slot is clicked", () => {
    render(<CharacterPanelWorkspace />);

    const portraitCard = screen.getByText("Portrait").closest("article");
    expect(portraitCard).not.toBeNull();
    fireEvent.click(portraitCard!);
    expect(handleCharacterSheetCardClickMock).toHaveBeenCalledTimes(1);
  });

  it("blocks external uploads when all reference slots are already filled", async () => {
    const onExternalUploadRequestHandled = vi.fn();
    currentDraftState = {
      ...createDraftState(),
      characterSheetPresetAssignments: {
        portrait: {
          characterMediaId: "media-portrait",
          storagePath: "path/portrait.png",
          previewStoragePath: "path/portrait-thumb.png",
          previewUrl: "https://example.com/portrait.png",
        },
        close_up: {
          characterMediaId: "media-close",
          storagePath: "path/close.png",
          previewStoragePath: "path/close-thumb.png",
          previewUrl: "https://example.com/close.png",
        },
        front_shot: {
          characterMediaId: "media-front",
          storagePath: "path/front.png",
          previewStoragePath: "path/front-thumb.png",
          previewUrl: "https://example.com/front.png",
        },
      },
    };

    render(
      <CharacterPanelWorkspace
        externalUploadRequest={{
          requestId: 3,
          files: [new File(["x"], "ref.png", { type: "image/png" })],
        }}
        onExternalUploadRequestHandled={onExternalUploadRequestHandled}
      />
    );

    await waitFor(() => {
      expect(setErrorMessageMock).toHaveBeenCalledWith(
        "All character reference slots are filled. Clear a slot before adding more media."
      );
    });
    expect(setCharacterSheetPresetFileMock).not.toHaveBeenCalled();
    expect(onExternalUploadRequestHandled).not.toHaveBeenCalled();
  });

  it("acknowledges external uploads only after assignment succeeds", async () => {
    const onExternalUploadRequestHandled = vi.fn();
    let resolveUpload: ((value: boolean) => void) | null = null;
    setCharacterSheetPresetFileMock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveUpload = resolve;
        })
    );

    render(
      <CharacterPanelWorkspace
        externalUploadRequest={{
          requestId: 7,
          files: [new File(["x"], "ref.png", { type: "image/png" })],
        }}
        onExternalUploadRequestHandled={onExternalUploadRequestHandled}
      />
    );

    await waitFor(() => {
      expect(setCharacterSheetPresetFileMock).toHaveBeenCalledTimes(1);
    });
    expect(onExternalUploadRequestHandled).not.toHaveBeenCalled();

    resolveUpload?.(true);

    await waitFor(() => {
      expect(onExternalUploadRequestHandled).toHaveBeenCalledWith(7);
    });
  });
});
