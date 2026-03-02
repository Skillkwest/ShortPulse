/**
 * Character Manager layout tests.
 * Verifies create-surface region order is stable across page and embedded panel surfaces.
 */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CharacterManagerShell } from "../CharacterManagerShell";
import {
  createDefaultCharacterSheetPresetState,
  createEmptyCharacterSheetAssignments,
  createEmptyCharacterSheetPresetAssignments,
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
    removeItem: async () => true,
    restoreItem: async () => true,
    loadMoreArchived: async () => undefined,
    refresh: async () => undefined,
    clearError: () => undefined,
  }),
}));

const resolveLayoutOrder = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll("[data-layout-region]"))
    .map((node) => node.getAttribute("data-layout-region"))
    .filter((value): value is string => Boolean(value));

describe("CharacterManagerShell layout", () => {
  it("renders create layout regions in stable order on page surface", () => {
    const { container } = render(<CharacterManagerShell />);
    expect(resolveLayoutOrder(container)).toEqual(["identity", "quickswap", "sheet"]);
    expect(screen.getByRole("heading", { name: "Identity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "QuickSwap Deck" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Character Sheet" })).toBeInTheDocument();
  });

  it("renders create layout regions in stable order on panel surface", () => {
    const { container } = render(<CharacterManagerShell surface="panel" beginnerModeOverride />);
    expect(resolveLayoutOrder(container)).toEqual(["identity", "quickswap", "sheet"]);
    expect(screen.getByRole("heading", { name: "Identity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "QuickSwap Deck" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Character Sheet" })).toBeInTheDocument();
  });
});
