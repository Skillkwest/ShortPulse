/**
 * Persistence command helpers for styles-library edit/create/delete actions.
 */
import type { StylesLibraryStyleDetails } from "../../types";

/**
 * Runs a guarded style-delete command and normalizes failure handling.
 */
export const runDeleteStyleCommand = async ({
  styleId,
  onDeleteStyle,
}: {
  styleId: string;
  onDeleteStyle?: (styleId: string) => Promise<boolean> | boolean;
}): Promise<boolean> => {
  if (!onDeleteStyle || !styleId.trim()) return false;
  try {
    return Boolean(await onDeleteStyle(styleId));
  } catch {
    return false;
  }
};

/**
 * Runs a guarded style-save command and normalizes failure handling.
 */
export const runSaveStyleDetailsCommand = async ({
  styleId,
  details,
  onSaveStyleDetails,
}: {
  styleId: string;
  details: StylesLibraryStyleDetails;
  onSaveStyleDetails?: (
    styleId: string,
    details: StylesLibraryStyleDetails
  ) => Promise<boolean> | boolean;
}): Promise<boolean> => {
  if (!onSaveStyleDetails || !styleId.trim()) return false;
  try {
    return Boolean(await onSaveStyleDetails(styleId, details));
  } catch {
    return false;
  }
};
