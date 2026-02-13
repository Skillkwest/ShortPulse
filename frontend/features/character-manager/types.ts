/**
 * Shared types for Character Manager draft intake and slot state.
 * Defines the fixed 10-shot schema used to build a reference pack.
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
