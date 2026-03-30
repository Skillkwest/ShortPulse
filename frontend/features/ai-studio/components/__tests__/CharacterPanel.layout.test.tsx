/**
 * AI Studio Character panel layout tests.
 * Verifies embedded Character Manager region order and section presence.
 */
import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  it("defaults embedded character workflow to Character Profile and keeps layout stable", () => {
    const { container } = render(<CharacterPanel beginnerMode />);
    const quickSwapHelperCopy =
      "The quick swap deck is a small library of images you can quickly access to swap out your character's style on the fly.";
    const workflowTablist = screen.getByRole("tablist", { name: "Character workflow mode" });
    const workflowTabs = within(workflowTablist).getAllByRole("tab");

    expect(workflowTabs[0]).toHaveTextContent("Manage Characters");
    expect(workflowTabs[1]).toHaveTextContent("Character Profile");
    expect(screen.getByRole("tab", { name: "Character Profile" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("Characters")).toBeInTheDocument();

    const regions = Array.from(container.querySelectorAll("[data-layout-region]"))
      .map((node) => node.getAttribute("data-layout-region"))
      .filter((value): value is string => Boolean(value));
    expect(regions).toEqual(["quickswap", "sheet"]);
    expect(screen.getByRole("heading", { name: "QuickSwap Deck" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Character Sheet" })).toBeInTheDocument();
    expect(screen.queryByText(quickSwapHelperCopy)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Manage Characters" }));
    expect(screen.getByRole("heading", { name: "Character Library" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "QuickSwap Deck" })).not.toBeInTheDocument();
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

  it("locks properties rail scrolling only while Character Profile tab is active", () => {
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

    fireEvent.click(screen.getByRole("tab", { name: "Manage Characters" }));
    expect(propertiesRail.style.overflowY).toBe("auto");
    expect(propertiesRail.style.overscrollBehaviorY).toBe("auto");

    fireEvent.click(screen.getByRole("tab", { name: "Character Profile" }));
    expect(propertiesRail.style.overflowY).toBe("hidden");
    expect(propertiesRail.style.overscrollBehaviorY).toBe("none");
  });
});
