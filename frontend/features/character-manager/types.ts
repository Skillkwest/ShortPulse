/**
 * Shared types for Character Manager draft intake and slot state.
 * Defines the canonical reference-slot schema and UI assignment types.
 */

export type CharacterReferenceSlotKey =
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

export type CharacterReferenceSlotDefinition = {
  key: CharacterReferenceSlotKey;
  label: string;
  helper: string;
  hint: string;
};

export type CharacterSheetDropZoneKey = "portrait" | "close_up" | "front_shot" | "back_shot";

export type CharacterSheetAssignments = Record<
  CharacterSheetDropZoneKey,
  CharacterReferenceSlotKey | null
>;

export type CharacterSheetPresetId = "1" | "2" | "3" | "4";

export type CharacterSheetPresetMediaReference = {
  mediaFileId: string;
  storagePath: string;
  previewUrl: string | null;
};

export type CharacterSheetPresetAssignments = Record<
  CharacterSheetDropZoneKey,
  CharacterSheetPresetMediaReference | null
>;

export type CharacterSheetPresetMap = Record<
  CharacterSheetPresetId,
  CharacterSheetPresetAssignments
>;

export type CharacterSheetPresetState = {
  activePresetId: CharacterSheetPresetId;
  presets: CharacterSheetPresetMap;
};

export type CharacterSlotValidationStatus = "pending" | "pass" | "warn" | "fail";

export type CharacterSlotValidationNotes = {
  validatorVersion: number;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  sha256: string | null;
  hardErrors: string[];
  warnings: string[];
  evaluatedAt: string | null;
};

export type CharacterSlotFile = {
  mediaFileId: string;
  storagePath: string;
  validationStatus: CharacterSlotValidationStatus;
  validationNotes: CharacterSlotValidationNotes;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  updatedAt: string;
};

export type CharacterSlotFileMap = Record<CharacterReferenceSlotKey, CharacterSlotFile | null>;

export type CharacterProfileImageTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};
