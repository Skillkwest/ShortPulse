import { describe, expect, it } from "vitest";
import type {
  CharacterSheetAssignments,
  CharacterSheetPresetAssignments,
  CharacterSlotFile,
  CharacterSlotFileMap,
} from "../../../character-manager/types";
import {
  composeCharacterModePrompt,
  mergeCharacterAndUserReferences,
  resolveCharacterSheetLookReferenceStoragePaths,
  resolveCharacterSheetLookReferenceUrls,
  resolveCharacterSheetReferenceStoragePaths,
  resolveCharacterSheetReferenceUrls,
} from "../characterModePayload";

const createSlotFile = (previewUrl: string): CharacterSlotFile => ({
  characterMediaId: `media-${previewUrl}`,
  storagePath: previewUrl,
  validationStatus: "pass",
  validationNotes: {
    validatorVersion: 1,
    mimeType: "image/png",
    width: 1024,
    height: 1024,
    aspectRatio: 1,
    sha256: "hash",
    hardErrors: [],
    warnings: [],
    evaluatedAt: "2026-01-01T00:00:00.000Z",
  },
  name: "reference.png",
  size: 1024,
  type: "image/png",
  previewUrl,
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const createEmptySlots = (): CharacterSlotFileMap => ({
  front_full: null,
  side_profile: null,
  back_full: null,
  top_down: null,
  front_left_34: null,
  front_right_34: null,
  back_left_34: null,
  back_right_34: null,
  portrait_close: null,
  fullbody_wide: null,
});

describe("characterModePayload", () => {
  it("resolves Character Sheet references in canonical zone order and deduplicates URLs", () => {
    const assignments: CharacterSheetAssignments = {
      portrait: "portrait_close",
      close_up: "portrait_close",
      front_shot: "front_full",
    };
    const slots = createEmptySlots();
    slots.portrait_close = createSlotFile("https://cdn.test/portrait.png");
    slots.front_full = createSlotFile("https://cdn.test/front.png");

    expect(resolveCharacterSheetReferenceUrls(assignments, slots)).toEqual([
      "https://cdn.test/portrait.png",
      "https://cdn.test/front.png",
    ]);
  });

  it("resolves Character Sheet storage paths in canonical zone order and deduplicates", () => {
    const assignments: CharacterSheetAssignments = {
      portrait: "portrait_close",
      close_up: "portrait_close",
      front_shot: "front_full",
    };
    const slots = createEmptySlots();
    slots.portrait_close = createSlotFile("https://cdn.test/portrait.png");
    slots.portrait_close.storagePath = "user/characters/portrait.png";
    slots.front_full = createSlotFile("https://cdn.test/front.png");
    slots.front_full.storagePath = "user/characters/front.png";

    expect(resolveCharacterSheetReferenceStoragePaths(assignments, slots)).toEqual([
      "user/characters/portrait.png",
      "user/characters/front.png",
    ]);
  });

  it("resolves look references in canonical zone order and deduplicates", () => {
    const lookAssignments: CharacterSheetPresetAssignments = {
      portrait: {
        characterMediaId: "media-portrait",
        storagePath: "user/characters/presets/portrait.png",
        previewUrl: "https://cdn.test/portrait.png",
      },
      close_up: {
        characterMediaId: "media-portrait",
        storagePath: "user/characters/presets/portrait.png",
        previewUrl: "https://cdn.test/portrait.png",
      },
      front_shot: {
        characterMediaId: "media-front",
        storagePath: "user/characters/presets/front.png",
        previewUrl: "https://cdn.test/front.png",
      },
    };

    expect(resolveCharacterSheetLookReferenceUrls(lookAssignments)).toEqual([
      "https://cdn.test/portrait.png",
      "https://cdn.test/front.png",
    ]);
    expect(resolveCharacterSheetLookReferenceStoragePaths(lookAssignments)).toEqual([
      "user/characters/presets/portrait.png",
      "user/characters/presets/front.png",
    ]);
  });

  it("composes hidden character description before the user prompt", () => {
    expect(
      composeCharacterModePrompt({
        characterDescription: "Tall cyberpunk detective with silver trench coat.",
        userPrompt: "Walking through neon rain at night.",
      })
    ).toBe(
      "Tall cyberpunk detective with silver trench coat.\n\nWalking through neon rain at night."
    );
  });

  it("falls back to the user prompt when no character description is present", () => {
    expect(
      composeCharacterModePrompt({
        characterDescription: "",
        userPrompt: "Portrait, rim lighting, 85mm lens.",
      })
    ).toBe("Portrait, rim lighting, 85mm lens.");
  });

  it("merges references with user URLs first, deduplicated and capped", () => {
    const merged = mergeCharacterAndUserReferences(
      ["https://cdn.test/two.png", "https://cdn.test/three.png", "https://cdn.test/four.png"],
      ["https://cdn.test/one.png", "https://cdn.test/two.png"],
      3
    );

    expect(merged).toEqual([
      "https://cdn.test/two.png",
      "https://cdn.test/three.png",
      "https://cdn.test/four.png",
    ]);
  });
});
