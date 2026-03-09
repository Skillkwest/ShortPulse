/**
 * Character Manager layout tests.
 * Verifies create-surface region order is stable across page and embedded panel surfaces.
 */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CharacterManagerShell } from "../CharacterManagerShell";
import {
  CHARACTER_SHEET_PRESET_IDS,
  createDefaultCharacterSheetPresetState,
  createEmptyCharacterSheetAssignments,
  createEmptyCharacterSheetPresetAssignments,
  getDefaultCharacterSheetPresetTabLabel,
} from "../../constants";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <div data-testid="mock-next-image" {...props} />,
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
  }),
}));

vi.mock("../../hooks/useCharacterManagerDraft", () => ({
  useCharacterManagerDraft: () => ({
    characters: [],
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
    profileImageUrl: null,
    profileImageTransform: {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    },
    slots: {},
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
    saveCharacterSheetAssignments: async () => true,
    setActiveCharacterSheetPreset: async () => true,
    saveCharacterSheetPresetAssignments: async () => true,
    addCharacterSheetPreset: async () => true,
    renameCharacterSheetPreset: async () => true,
    deleteCharacterSheetPreset: async () => true,
    setCharacterSheetPresetFile: async () => true,
    createCharacter: async () => undefined,
    selectCharacter: async () => undefined,
    deleteCharacter: async () => true,
    clearMessages: () => undefined,
  }),
}));

vi.mock("../../hooks/useCharacterQuickSwapDeck", () => ({
  useCharacterQuickSwapDeck: () => ({
    activeItems: [],
    archivedItems: [],
    archivedCount: 0,
    loading: false,
    loadingArchived: false,
    mutating: false,
    error: null,
    hasMoreArchived: false,
    appendFiles: async () => true,
    appendExistingMediaReference: async () => true,
    removeItem: async () => true,
    restoreItem: async () => true,
    loadMoreArchived: async () => undefined,
    refresh: async () => undefined,
    clearError: () => undefined,
  }),
}));

vi.mock("../../hooks/useCharacterQuickSwapTipPreference", () => ({
  useCharacterQuickSwapTipPreference: () => ({
    isQuickSwapTipHidden: false,
    loading: false,
    error: null,
    syncState: "ready",
    markQuickSwapTipHidden: async () => true,
  }),
}));

const resolveLayoutOrder = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll("[data-layout-region]"))
    .map((node) => node.getAttribute("data-layout-region"))
    .filter((value): value is string => Boolean(value));

describe("CharacterManagerShell layout", () => {
  it("renders create layout regions in stable order on page surface", () => {
    const { container } = render(<CharacterManagerShell />);
    expect(resolveLayoutOrder(container)).toEqual(["quickswap", "sheet"]);
    expect(screen.getByRole("heading", { name: "QuickSwap Deck" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Character Sheet" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Identity" })).not.toBeInTheDocument();

    const descriptionInput = container.querySelector("#character-manager-description");
    const nameInput = container.querySelector("#character-manager-name");
    const sheetRegion = container.querySelector("[data-layout-region='sheet']");

    expect(descriptionInput).toBeInTheDocument();
    expect(nameInput).toBeInTheDocument();
    expect(descriptionInput?.closest("[data-layout-region]")).toBe(sheetRegion);
    expect(nameInput?.closest("[data-layout-region]")).toBe(sheetRegion);
  });

  it("renders create layout regions in stable order on panel surface", () => {
    const { container } = render(<CharacterManagerShell surface="panel" beginnerModeOverride />);
    expect(resolveLayoutOrder(container)).toEqual(["quickswap", "sheet"]);
    expect(screen.getByRole("heading", { name: "QuickSwap Deck" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Character Sheet" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Identity" })).not.toBeInTheDocument();

    const guidance = container.querySelector(".character-mode-guidance");
    const quickSwapRegion = container.querySelector("[data-layout-region='quickswap']");
    const sheetRegion = container.querySelector("[data-layout-region='sheet']");

    expect(guidance).toBeInTheDocument();
    expect(guidance?.closest("[data-layout-region]")).toBe(quickSwapRegion);
    expect(sheetRegion?.querySelector(".character-mode-guidance")).toBeNull();
  });
});
