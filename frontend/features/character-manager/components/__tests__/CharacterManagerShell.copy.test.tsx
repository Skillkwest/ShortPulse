/**
 * Character Manager copy regression tests.
 * Guards key user-facing terminology in the Character Manager create surface.
 */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CharacterManagerShell } from "../CharacterManagerShell";
import { createEmptyCharacterSheetAssignments } from "../../constants";

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
    setCharacterName: () => undefined,
    setCharacterDescription: () => undefined,
    setProfileImageFile: async () => undefined,
    saveProfileImageTransform: async () => true,
    clearProfileImage: async () => undefined,
    saveCharacterSheetAssignments: async () => true,
    setSlotFile: async () => undefined,
    clearSlot: async () => undefined,
    createCharacter: async () => undefined,
    selectCharacter: async () => undefined,
    deleteCharacter: async () => true,
    isSlotBusy: () => false,
    clearMessages: () => undefined,
  }),
}));

describe("CharacterManagerShell copy", () => {
  it("renders Character Sheet heading in create mode", () => {
    render(<CharacterManagerShell />);

    expect(screen.getByRole("heading", { name: "Character Sheet" })).toBeInTheDocument();
  });
});
