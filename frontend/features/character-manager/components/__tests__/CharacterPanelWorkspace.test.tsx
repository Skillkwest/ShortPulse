import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const clearCharacterSheetAssignmentMock = vi.fn();

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
  characterSaveProgressMessage: null as string | null,
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
    clearCharacterSheetAssignment: clearCharacterSheetAssignmentMock,
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
  ConfirmationModal: ({
    title,
    body,
    confirmLabel,
    onConfirm,
    onCancel,
    children,
  }: {
    title?: ReactNode;
    body?: ReactNode;
    confirmLabel?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    children?: ReactNode;
  }) => (
    <div role="dialog" aria-label={typeof title === "string" ? title : "Confirmation"}>
      {title ? <div>{title}</div> : null}
      {body ? <div>{body}</div> : null}
      {children}
      {confirmLabel ? (
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      ) : null}
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

describe("CharacterPanelWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    currentDraftState = createDraftState();
    setCharacterSheetPresetFileMock.mockResolvedValue(true);
    handleCharacterSheetCardClickMock.mockReset();
    clearCharacterSheetAssignmentMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the new library/profile layout without QuickSwap shell copy", () => {
    render(<CharacterPanelWorkspace />);

    expect(screen.queryByRole("heading", { name: "Characters" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Characters Library" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Character Profile" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Characters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "4" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "5" })).not.toBeInTheDocument();
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
    expect(screen.getByText("Portrait")).toHaveStyle({
      minHeight: "28px",
      justifyContent: "center",
      alignItems: "center",
    });
  });

  it("opens the saved character grid inside the Characters modal", () => {
    render(<CharacterPanelWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Characters" }));

    const dialog = screen.getByRole("dialog", { name: "Character library" });
    expect(dialog).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /\+ create new character/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Saved characters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selected Taylor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Taylor" })).toBeInTheDocument();
  });

  it("creates a new character from the Characters modal header action", async () => {
    const createCharacterMock = vi.fn(async () => undefined);
    currentDraftState = {
      ...createDraftState(),
      createCharacter: createCharacterMock,
    };

    render(<CharacterPanelWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Characters" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /\+ create new character/i }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createCharacterMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Character library" })).not.toBeInTheDocument();
  });

  it("opens character deletion from the modal card trash icon", () => {
    render(<CharacterPanelWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Characters" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Taylor" }));

    const confirmationDialog = screen.getByRole("dialog", { name: "Delete this character?" });
    expect(confirmationDialog).toBeInTheDocument();
    expect(confirmationDialog).toHaveTextContent("Taylor");
    expect(confirmationDialog).toHaveTextContent("removed permanently");
  });

  it("opens the direct slot picker when an empty reference slot is clicked", () => {
    render(<CharacterPanelWorkspace />);

    const portraitCard = screen.getByText("Portrait").closest("article");
    expect(portraitCard).not.toBeNull();
    fireEvent.click(portraitCard!);
    expect(handleCharacterSheetCardClickMock).toHaveBeenCalledTimes(1);
  });

  it("keeps save available for existing characters and triggers an explicit save", async () => {
    const saveCharacterMock = vi.fn(async () => true);
    currentDraftState = {
      ...createDraftState(),
      saveCharacter: saveCharacterMock,
    };

    render(<CharacterPanelWorkspace />);

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeEnabled();

    await act(async () => {
      fireEvent.click(saveButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveCharacterMock).toHaveBeenCalledTimes(1);
  });

  it("shows a visible saving indicator beside the Characters button while character save is in progress", () => {
    currentDraftState = {
      ...createDraftState(),
      isSavingCharacter: true,
      characterSaveProgressMessage: "Saving references...",
    };

    render(<CharacterPanelWorkspace />);

    const saveStatus = screen.getByRole("status", { name: "Saving references..." });
    expect(saveStatus).toBeInTheDocument();
    expect(saveStatus).toHaveTextContent("Saving references...");
    expect(screen.getByRole("button", { name: "Characters" })).toHaveAttribute(
      "aria-describedby",
      "character-save-progress-status"
    );
    expect(screen.getByRole("button", { name: "Characters" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
  });

  it("keeps the Characters modal browsable but read-only while character save is in progress", () => {
    const selectCharacterMock = vi.fn(async () => undefined);
    const createCharacterMock = vi.fn(async () => undefined);
    currentDraftState = {
      ...createDraftState(),
      isSavingCharacter: true,
      characterSaveProgressMessage: "Loading saved character...",
      createCharacter: createCharacterMock,
      selectCharacter: selectCharacterMock,
    };

    render(<CharacterPanelWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Characters" }));

    const dialog = screen.getByRole("dialog", { name: "Character library" });
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole("status", { name: "Loading saved character..." })
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /\+ create new character/i })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Selected Taylor" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Delete Taylor" })).toBeDisabled();
    expect(selectCharacterMock).not.toHaveBeenCalled();
    expect(createCharacterMock).not.toHaveBeenCalled();
  });

  it("shows a brief saved check indicator after a successful save", async () => {
    vi.useFakeTimers();
    const saveCharacterMock = vi.fn(async () => true);
    currentDraftState = {
      ...createDraftState(),
      saveCharacter: saveCharacterMock,
    };

    render(<CharacterPanelWorkspace />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText("Character saved")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2300);
      await Promise.resolve();
    });

    expect(screen.queryByLabelText("Character saved")).not.toBeInTheDocument();
  });

  it("shows the clear button on hover and clears an assigned slot when clicked", async () => {
    currentDraftState = {
      ...createDraftState(),
      characterSheetPresetAssignments: {
        portrait: {
          characterMediaId: "media-portrait",
          storagePath: "path/portrait.png",
          previewStoragePath: "path/portrait-thumb.png",
          previewUrl: "https://example.com/portrait.png",
        },
        close_up: null,
        front_shot: null,
      },
    };

    render(<CharacterPanelWorkspace />);

    const clearButton = screen.getByRole("button", { name: "Clear Portrait reference" });
    expect(clearButton).toHaveStyle({ opacity: "0", pointerEvents: "none" });

    const portraitCard = screen.getByAltText("Portrait reference").closest("article");
    expect(portraitCard).not.toBeNull();
    fireEvent.mouseEnter(portraitCard!);

    await waitFor(() => {
      expect(clearButton).toHaveStyle({ opacity: "1", pointerEvents: "auto" });
    });

    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(clearCharacterSheetAssignmentMock).toHaveBeenCalledWith("portrait");
    });
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
    let resolveUploadPromise!: (value: boolean) => void;
    const uploadPromise = new Promise<boolean>((resolve) => {
      resolveUploadPromise = resolve;
    });
    setCharacterSheetPresetFileMock.mockImplementation(() => uploadPromise);

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

    resolveUploadPromise(true);

    await waitFor(() => {
      expect(onExternalUploadRequestHandled).toHaveBeenCalledWith(7);
    });
  });
});
