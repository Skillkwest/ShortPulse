/**
 * Character Manager constants.
 * Provides canonical reference-slot definitions and lightweight client-side constraints.
 */
import type {
  CharacterSheetAssignments,
  CharacterSheetDropZoneKey,
  CharacterReferenceSlotDefinition,
  CharacterReferenceSlotKey,
  CharacterSlotFileMap,
} from "./types";

export const CHARACTER_MANAGER_SLOT_DEFINITIONS: CharacterReferenceSlotDefinition[] = [
  {
    key: "front_full",
    label: "Front Full Body",
    helper: "Neutral front-facing pose, full body in frame.",
    hint: "Arms relaxed at sides. Keep feet visible.",
  },
  {
    key: "back_full",
    label: "Back Full Body",
    helper: "Direct back view, full body visible.",
    hint: "Capture hair, outfit, and silhouette from behind.",
  },
  {
    key: "side_profile",
    label: "Left Side Body Profile",
    helper: "Exact left-side profile, full body visible.",
    hint: "No torso twist. Keep head aligned with body.",
  },
  {
    key: "top_down",
    label: "Top-Down View",
    helper: "Camera above character with a clear silhouette.",
    hint: "Keep the full body visible from overhead.",
  },
  {
    key: "front_left_34",
    label: "3/4 Front Left",
    helper: "45-degree front-left full-body angle.",
    hint: "Face and torso both clearly visible.",
  },
  {
    key: "front_right_34",
    label: "3/4 Front Right",
    helper: "45-degree front-right full-body angle.",
    hint: "Match framing style from front-left shot.",
  },
  {
    key: "back_left_34",
    label: "3/4 Back Left",
    helper: "45-degree back-left full-body angle.",
    hint: "Keep shape and outfit details visible.",
  },
  {
    key: "back_right_34",
    label: "3/4 Back Right",
    helper: "45-degree back-right full-body angle.",
    hint: "Keep consistent camera distance.",
  },
  {
    key: "portrait_close",
    label: "Extreme Portrait Close-up",
    helper: "Tight facial framing for identity detail.",
    hint: "Eyes, nose, and mouth should be sharp and centered.",
  },
  {
    key: "fullbody_wide",
    label: "Zoomed-Out Scale Shot",
    helper: "Wider full-body framing for proportions and scale.",
    hint: "Include surrounding space around character.",
  },
];

export const CHARACTER_MANAGER_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export const createEmptyCharacterSlotMap = (): CharacterSlotFileMap =>
  CHARACTER_MANAGER_SLOT_DEFINITIONS.reduce((acc, slot) => {
    acc[slot.key] = null;
    return acc;
  }, {} as CharacterSlotFileMap);

export const CHARACTER_MANAGER_SLOT_KEYS = CHARACTER_MANAGER_SLOT_DEFINITIONS.map(
  (slot) => slot.key
) as CharacterReferenceSlotKey[];

export const CHARACTER_MANAGER_SLOT_LABEL_BY_KEY = CHARACTER_MANAGER_SLOT_DEFINITIONS.reduce(
  (acc, slot) => {
    acc[slot.key] = slot.label;
    return acc;
  },
  {} as Record<CharacterReferenceSlotKey, string>
);

export const CHARACTER_SHEET_DROP_ZONES = [
  { key: "portrait", label: "Portrait" },
  { key: "close_up", label: "Close-up" },
  { key: "front_shot", label: "Full-body Front Shot" },
  { key: "back_shot", label: "Full-body Back Shot" },
] as const satisfies ReadonlyArray<{ key: CharacterSheetDropZoneKey; label: string }>;

export const createEmptyCharacterSheetAssignments = (): CharacterSheetAssignments =>
  CHARACTER_SHEET_DROP_ZONES.reduce((acc, slot) => {
    acc[slot.key] = null;
    return acc;
  }, {} as CharacterSheetAssignments);
