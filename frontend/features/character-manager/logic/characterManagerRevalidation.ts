/**
 * Character Manager character-sheet revalidation.
 * Re-runs deterministic checks for persisted slot images and stores updated statuses/notes.
 */
import {
  CHARACTER_MANAGER_SLOT_DEFINITIONS,
  CHARACTER_MANAGER_SLOT_KEYS,
  CHARACTER_MANAGER_SLOT_LABEL_BY_KEY,
  createEmptyCharacterSlotMap,
} from "../constants";
import { validateCharacterReferenceFile } from "./referenceValidation";
import type {
  CharacterReferenceSlotKey,
  CharacterSlotValidationNotes,
  CharacterSlotValidationStatus,
} from "../types";
import {
  asErrorMessage,
  isCharacterReferenceSlotKey,
  resolveSupabaseContext,
} from "./characterManagerPersistenceCore";

const MEDIA_BUCKET = "media_library";

type CharacterReferenceImageRow = {
  id: string;
  slot_key: string;
  storage_path: string;
};

type SlotValidationRecord = {
  rowId: string;
  slotKey: CharacterReferenceSlotKey;
  status: CharacterSlotValidationStatus;
  notes: CharacterSlotValidationNotes;
};

export type CharacterSheetRevalidationSummary = {
  totalCount: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  failedLabels: string[];
};

const markDuplicateFailures = (records: SlotValidationRecord[]) => {
  const slotKeysByHash = new Map<string, CharacterReferenceSlotKey[]>();
  for (const record of records) {
    const hash = record.notes.sha256?.trim();
    if (!hash) continue;
    const existing = slotKeysByHash.get(hash) ?? [];
    existing.push(record.slotKey);
    slotKeysByHash.set(hash, existing);
  }

  for (const duplicateSlots of slotKeysByHash.values()) {
    if (duplicateSlots.length <= 1) continue;
    const duplicateLabels = duplicateSlots.map(
      (slotKey) => CHARACTER_MANAGER_SLOT_LABEL_BY_KEY[slotKey]
    );
    const duplicateMessage = `Duplicate image used across slots: ${duplicateLabels.join(", ")}.`;
    for (const slotKey of duplicateSlots) {
      const record = records.find((item) => item.slotKey === slotKey);
      if (!record) continue;
      if (!record.notes.hardErrors.includes(duplicateMessage)) {
        record.notes.hardErrors = [...record.notes.hardErrors, duplicateMessage];
      }
      record.status = "fail";
    }
  }
};

/**
 * Revalidate all persisted slot images in a character sheet and persist updated statuses.
 */
export const revalidateCharacterManagerCharacterSheet = async ({
  characterSheetId,
}: {
  characterSheetId: string;
}): Promise<CharacterSheetRevalidationSummary> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: rows, error } = await supabase
    .from("character_reference_images")
    .select("id, slot_key, storage_path")
    .eq("user_id", userId)
    .eq("character_sheet_id", characterSheetId);
  if (error) {
    throw new Error(asErrorMessage(error, "Failed to load character sheet for revalidation."));
  }

  const typedRows = (rows ?? []) as CharacterReferenceImageRow[];
  const records: SlotValidationRecord[] = [];
  for (const row of typedRows) {
    if (!isCharacterReferenceSlotKey(row.slot_key)) continue;

    try {
      const { data: blob, error: downloadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .download(row.storage_path);
      if (downloadError || !blob) {
        records.push({
          rowId: row.id,
          slotKey: row.slot_key,
          status: "fail",
          notes: {
            validatorVersion: 1,
            mimeType: null,
            width: null,
            height: null,
            aspectRatio: null,
            sha256: null,
            hardErrors: ["Image could not be downloaded for validation."],
            warnings: [],
            evaluatedAt: new Date().toISOString(),
          },
        });
        continue;
      }

      const extension = blob.type.split("/")[1] || "jpg";
      const file = new File([blob], `${row.slot_key}.${extension}`, {
        type: blob.type || "image/jpeg",
      });
      const validation = await validateCharacterReferenceFile({
        slotKey: row.slot_key,
        file,
        existingSlots: createEmptyCharacterSlotMap(),
      });
      records.push({
        rowId: row.id,
        slotKey: row.slot_key,
        status: validation.status,
        notes: validation.notes,
      });
    } catch {
      records.push({
        rowId: row.id,
        slotKey: row.slot_key,
        status: "fail",
        notes: {
          validatorVersion: 1,
          mimeType: null,
          width: null,
          height: null,
          aspectRatio: null,
          sha256: null,
          hardErrors: ["Unexpected validation failure. Re-upload this shot."],
          warnings: [],
          evaluatedAt: new Date().toISOString(),
        },
      });
    }
  }

  markDuplicateFailures(records);
  for (const record of records) {
    const { error: updateError } = await supabase
      .from("character_reference_images")
      .update({
        validation_status: record.status,
        validation_notes: record.notes,
      })
      .eq("id", record.rowId)
      .eq("user_id", userId);
    if (updateError) {
      throw new Error(asErrorMessage(updateError, "Failed to persist revalidation results."));
    }
  }

  const failSlots = new Set<CharacterReferenceSlotKey>();
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  for (const record of records) {
    if (record.status === "pass") passCount += 1;
    if (record.status === "warn") warnCount += 1;
    if (record.status === "fail") {
      failCount += 1;
      failSlots.add(record.slotKey);
    }
  }

  const failedLabels = CHARACTER_MANAGER_SLOT_DEFINITIONS.filter((slot) =>
    failSlots.has(slot.key)
  ).map((slot) => slot.label);

  return {
    totalCount: CHARACTER_MANAGER_SLOT_KEYS.length,
    passCount,
    warnCount,
    failCount,
    failedLabels,
  };
};
