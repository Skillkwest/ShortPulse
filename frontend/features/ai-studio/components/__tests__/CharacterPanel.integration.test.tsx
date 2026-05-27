import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterPanel } from "../CharacterPanel";
import {
  CHARACTER_SHEET_PRESET_IDS,
  createDefaultCharacterSheetPresetState,
  createEmptyCharacterSheetPresetAssignments,
  getDefaultCharacterSheetPresetTabLabel,
} from "../../../character-manager/constants";

const embeddedMediaPanelSpy = vi.fn();
const useCharacterPanelDraftSpy = vi.fn();

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
  activeCharacterSheetPresetId: "1" as const,
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
  isDeletingCharacterSheetPreset: false,
  hasUnsavedCharacterDraft: false,
  setCharacterName: () => undefined,
  setCharacterDescription: () => undefined,
  setActiveCharacterSheetPreset: async () => true,
  saveCharacterSheetPresetAssignments: async () => true,
  addCharacterSheetPreset: async () => true,
  renameCharacterSheetPreset: async () => true,
  deleteCharacterSheetPreset: async () => true,
  setCharacterSheetPresetFile: async () => true,
  createCharacter: async () => undefined,
  saveCharacter: async () => true,
  selectCharacter: async () => undefined,
  deleteCharacter: async () => true,
  clearMessages: () => undefined,
  setErrorMessage: () => undefined,
});

let currentDraftState = createDraftState();

vi.mock("next/image", () => ({
  default: ({ unoptimized, ...props }: Record<string, unknown>) => {
    void unoptimized;
    // eslint-disable-next-line @next/next/no-img-element -- Test shim for next/image.
    return <img alt="" {...props} />;
  },
}));

vi.mock("../ElementsEmbeddedMediaLibraryPanel", () => ({
  ElementsEmbeddedMediaLibraryPanel: (props: Record<string, unknown>) => {
    embeddedMediaPanelSpy(props);
    return <div data-testid="character-bottom-media-library" />;
  },
}));

vi.mock("../../hooks/useCharacterPanelPropertiesScrollLock", () => ({
  useCharacterPanelPropertiesScrollLock: () => undefined,
}));

vi.mock("../../../character-manager/hooks/useCharacterPanelDraft", () => ({
  useCharacterPanelDraft: (args: Record<string, unknown>) => {
    useCharacterPanelDraftSpy(args);
    return currentDraftState;
  },
}));

vi.mock("../../../character-manager/hooks/useCharacterManagerDroppedReferenceController", () => ({
  useCharacterManagerDroppedReferenceController: () => ({
    handleCharacterSheetReferenceDrop: async () => undefined,
  }),
}));

vi.mock("../../../character-manager/hooks/useCharacterManagerCharacterSheetInteractions", () => ({
  useCharacterManagerCharacterSheetInteractions: () => ({
    handleCharacterSheetFileSelection: () => undefined,
    handleCharacterSheetDragOver: () => () => undefined,
    clearCharacterSheetAssignment: () => undefined,
    handleCharacterSheetDrop: () => () => undefined,
    handleCharacterSheetCardClick: () => undefined,
  }),
}));

vi.mock("../../../character-manager/hooks/useCharacterManagerDragInteractions", () => ({
  useCharacterManagerDragInteractions: () => ({
    handleCharacterSheetDragStart: () => () => undefined,
    handleReferenceDragEnd: () => undefined,
  }),
}));

vi.mock("../../../character-manager/hooks/useCharacterCardPreviewUrls", () => ({
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
    confirmBusyLabel,
    confirmDisabled,
    cancelDisabled,
    onConfirm,
    onCancel,
    children,
  }: {
    title?: ReactNode;
    body?: ReactNode;
    confirmLabel?: string;
    confirmBusyLabel?: string;
    confirmDisabled?: boolean;
    cancelDisabled?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
    children?: ReactNode;
  }) => (
    <div role="dialog" aria-label={typeof title === "string" ? title : "Confirmation"}>
      {title ? <div>{title}</div> : null}
      {body ? <div>{body}</div> : null}
      {children}
      {confirmLabel ? (
        <button type="button" onClick={onConfirm} disabled={confirmDisabled}>
          {confirmDisabled && confirmBusyLabel ? confirmBusyLabel : confirmLabel}
        </button>
      ) : null}
      <button type="button" onClick={onCancel} disabled={cancelDisabled}>
        Cancel
      </button>
    </div>
  ),
}));

describe("CharacterPanel integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentDraftState = createDraftState();
  });

  it("renders the live panel stack and forwards project-aware props into the real workspace and media library seams", () => {
    const resolveMediaLibraryInternalDropItem = vi.fn();
    const resolveCharacterDropReference = vi.fn();
    const onSelectedCharacterIdChange = vi.fn();

    const { container } = render(
      <CharacterPanel
        projectId="project-123"
        projectRouteRequested
        selectedCharacterId="character-1"
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
        resolveCharacterDropReference={resolveCharacterDropReference}
        resolveMediaLibraryInternalDropItem={resolveMediaLibraryInternalDropItem}
      />
    );

    expect(screen.getByRole("button", { name: "Characters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Description:" })).toBeInTheDocument();
    expect(screen.getByTestId("character-bottom-media-library")).toBeInTheDocument();

    expect(container.querySelector(".character-panel-root")).not.toBeNull();
    expect(container.querySelector(".character-panel-split-host")).not.toBeNull();
    expect(container.querySelector(".character-panel-top-section")).not.toBeNull();
    expect(container.querySelector(".character-panel-bottom-section")).not.toBeNull();

    expect(useCharacterPanelDraftSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredCharacterId: "character-1",
        suppressSelectedCharacterPersistence: true,
        onSelectedCharacterIdChange,
      })
    );
    expect(embeddedMediaPanelSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fixedVisualAspectRatio: null,
        mediaCardInteractionMode: "assignment",
        projectId: "project-123",
        resolveInternalDropItem: resolveMediaLibraryInternalDropItem,
      })
    );
  });
});
