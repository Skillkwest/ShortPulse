/**
 * Character Manager interaction tests.
 * Verifies Character Sheet drag/drop behavior and 8-reference intake constraints.
 */
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CharacterManagerShell } from "../CharacterManagerShell";
import { createEmptyCharacterSheetAssignments } from "../../constants";

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

const createDataTransfer = (files: File[] = []) => {
  const dataStore = new Map<string, string>();
  return {
    files,
    effectAllowed: "all",
    dropEffect: "move",
    setDragImage: () => undefined,
    setData: (type: string, value: string) => {
      dataStore.set(type, value);
    },
    getData: (type: string) => dataStore.get(type) ?? "",
  };
};

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
  }),
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
      const uploadCounterRef = React.useRef(0);

      return {
        characters: [],
        selectedCharacterId: "character-1",
        characterName: "Taylor",
        characterDescription: "",
        characterSheetAssignments,
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
        setSlotFile: async (slotKey: MockCharacterReferenceSlotKey) => {
          uploadCounterRef.current += 1;
          setSlots((previous) => ({
            ...previous,
            [slotKey]: createMockSlotFile(
              slotKey,
              `https://example.com/${slotKey}-upload-${uploadCounterRef.current}.png`
            ),
          }));
        },
        clearSlot: async (slotKey: MockCharacterReferenceSlotKey) => {
          setSlots((previous) => ({
            ...previous,
            [slotKey]: null,
          }));
        },
        createCharacter: async () => undefined,
        selectCharacter: async () => undefined,
        deleteCharacter: async () => true,
        isSlotBusy: () => false,
        clearMessages: () => undefined,
      };
    },
  };
});

describe("CharacterManagerShell behavior", () => {
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

  it("does not auto-restore a cleared assignment when the same slot key is re-uploaded", async () => {
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
      expect(getZoneImageSrc("Portrait")).toBeNull();
    });

    const file = new File(["front-full"], "front-full.png", { type: "image/png" });
    const dropReferencesButton = screen.getByRole("button", {
      name: /Drop reference images here/i,
    });
    fireEvent.drop(dropReferencesButton, {
      dataTransfer: createDataTransfer([file]),
    });

    await waitFor(() => {
      expect(getZoneImageSrc("Portrait")).toBeNull();
    });
  });

  it("limits persisted uploaded references to eight cards", async () => {
    render(<CharacterManagerShell />);

    const dropReferencesButton = screen.getByRole("button", {
      name: /Drop reference images here/i,
    });
    const files = Array.from(
      { length: 10 },
      (_, index) => new File([`file-${index + 1}`], `file-${index + 1}.png`, { type: "image/png" })
    );
    fireEvent.drop(dropReferencesButton, {
      dataTransfer: createDataTransfer(files),
    });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Remove reference/i })).toHaveLength(8);
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

  it("toggles beginner mode guidance visibility", async () => {
    render(<CharacterManagerShell />);

    expect(document.querySelectorAll(".character-step-badge")).toHaveLength(3);
    expect(
      screen.getByText("Set the photo, name, and description that define this character.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Upload clear reference shots to build this character's source set.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Drag uploaded references into each slot to map your character's look and style."
      )
    ).toBeInTheDocument();
    expect(document.querySelector(".character-mode-guidance")).toBeInTheDocument();
    expect(document.querySelector(".character-mode-guidance")).toHaveTextContent(
      /Swap out your character's style on the fly by dragging and dropping references from the reference panel\./i
    );
    expect(
      screen.getByText(
        "Tip: Character description will be used as part of character consistency generation."
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Disable beginner mode/i }));

    await waitFor(() => {
      expect(document.querySelectorAll(".character-step-badge")).toHaveLength(0);
      expect(
        screen.queryByText("Set the photo, name, and description that define this character.")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Upload clear reference shots to build this character's source set.")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          "Drag uploaded references into each slot to map your character's look and style."
        )
      ).not.toBeInTheDocument();
      expect(document.querySelector(".character-mode-guidance")).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "Tip: Character description will be used as part of character consistency generation."
        )
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Enable beginner mode/i }));

    await waitFor(() => {
      expect(document.querySelectorAll(".character-step-badge")).toHaveLength(3);
      expect(
        screen.getByText("Set the photo, name, and description that define this character.")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Upload clear reference shots to build this character's source set.")
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Drag uploaded references into each slot to map your character's look and style."
        )
      ).toBeInTheDocument();
      expect(document.querySelector(".character-mode-guidance")).toBeInTheDocument();
      expect(document.querySelector(".character-mode-guidance")).toHaveTextContent(
        /Swap out your character's style on the fly by dragging and dropping references from the reference panel\./i
      );
      expect(
        screen.getByText(
          "Tip: Character description will be used as part of character consistency generation."
        )
      ).toBeInTheDocument();
    });
  });
});
