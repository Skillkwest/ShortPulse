/**
 * AI Studio Character panel layout tests.
 * Verifies embedded Character Manager region order and section presence.
 */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CharacterPanel } from "../CharacterPanel";
import {
  CHARACTER_SHEET_PRESET_IDS,
  createDefaultCharacterSheetPresetState,
  createEmptyCharacterSheetAssignments,
  createEmptyCharacterSheetPresetAssignments,
  getDefaultCharacterSheetPresetTabLabel,
} from "../../../character-manager/constants";

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
  useSupabaseSessionState: () => ({
    user: null,
    session: null,
    loading: false,
    error: null,
  }),
}));

vi.mock("../../../character-manager/hooks/useCharacterManagerDraft", () => ({
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

vi.mock("../../../character-manager/hooks/useCharacterQuickSwapDeck", () => ({
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

vi.mock("../../../character-manager/hooks/useCharacterQuickSwapTipPreference", () => ({
  useCharacterQuickSwapTipPreference: () => ({
    isQuickSwapTipHidden: false,
    loading: false,
    error: null,
    syncState: "ready",
    markQuickSwapTipHidden: async () => true,
  }),
}));

describe("CharacterPanel layout", () => {
  it("defaults embedded character workflow to Manage Characters and keeps layout stable", () => {
    const { container } = render(<CharacterPanel beginnerMode />);
    const quickSwapHelperCopy =
      "The quick swap deck is a small library of images you can quickly access to swap out your character's style on the fly.";
    expect(
      screen.queryByRole("tablist", { name: "Character workflow mode" })
    ).not.toBeInTheDocument();

    const regions = Array.from(container.querySelectorAll("[data-layout-region]"))
      .map((node) => node.getAttribute("data-layout-region"))
      .filter((value): value is string => Boolean(value));
    expect(regions).toEqual([]);
    expect(screen.getByRole("heading", { name: "Characters" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "QuickSwap Deck" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Character Sheet" })).not.toBeInTheDocument();
    expect(screen.queryByText(quickSwapHelperCopy)).not.toBeInTheDocument();
  });

  it("keeps embedded QuickSwap chrome lean in expert mode", () => {
    const quickSwapHelperCopy =
      "The quick swap deck is a small library of images you can quickly access to swap out your character's style on the fly.";

    render(<CharacterPanel beginnerMode={false} />);

    expect(screen.queryByText(quickSwapHelperCopy)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Collapse QuickSwap Deck|Expand QuickSwap Deck/i,
      })
    ).not.toBeInTheDocument();
  });

  it("locks the properties rail scroll in Manage Characters mode", () => {
    const { container } = render(
      <div className="ai-properties" style={{ overflowY: "auto", overscrollBehaviorY: "auto" }}>
        <CharacterPanel beginnerMode />
      </div>
    );
    const propertiesRail = container.querySelector(".ai-properties") as HTMLDivElement | null;
    if (!propertiesRail) {
      throw new Error("Expected ai-properties wrapper to exist.");
    }

    expect(propertiesRail.style.overflowY).toBe("hidden");
    expect(propertiesRail.style.overscrollBehaviorY).toBe("none");
  });
});
