/**
 * Reference Grid active-workset limits.
 * Defines the shared cap used by ingestion, generation, restore, and hydration paths.
 */
import type { StudioOutput } from "../../types";

export const REFERENCE_GRID_MAX_VISIBLE_ITEMS = 200;

export const REFERENCE_GRID_CAP_REACHED_MESSAGE = `Reference Grid is limited to ${REFERENCE_GRID_MAX_VISIBLE_ITEMS} items. Remove items from the grid or use Media Library as your archive before adding more.`;

export const buildReferenceGridOverflowArchivedMessage = (archivedCount: number): string => {
  const normalizedArchivedCount = Math.max(0, Math.floor(archivedCount));
  const itemLabel = normalizedArchivedCount === 1 ? "reference was" : "references were";
  return `Reference Grid is limited to ${REFERENCE_GRID_MAX_VISIBLE_ITEMS} items. ${normalizedArchivedCount} older ${itemLabel} moved to Archived to keep the grid responsive.`;
};

export const buildReferenceGridPartialCapMessage = (skippedCount: number): string => {
  const normalizedSkippedCount = Math.max(0, Math.floor(skippedCount));
  if (normalizedSkippedCount <= 0) return REFERENCE_GRID_CAP_REACHED_MESSAGE;
  const itemLabel = normalizedSkippedCount === 1 ? "item was" : "items were";
  return `Reference Grid is limited to ${REFERENCE_GRID_MAX_VISIBLE_ITEMS} items. ${normalizedSkippedCount} ${itemLabel} not added. Remove items from the grid or use Media Library as your archive before adding more.`;
};

/**
 * Returns whether an output counts toward the visible Reference Grid cap.
 */
export const isReferenceGridVisibleOutput = (
  output: Pick<StudioOutput, "hiddenInReferenceGrid">
): boolean => output.hiddenInReferenceGrid !== true;

/**
 * Counts active outputs that can render in All Refs or Quick Slot.
 */
export const countReferenceGridVisibleOutputs = (
  outputs: readonly Pick<StudioOutput, "hiddenInReferenceGrid">[]
): number =>
  outputs.reduce((count, output) => count + (isReferenceGridVisibleOutput(output) ? 1 : 0), 0);

/**
 * Returns the remaining visible slots before the Reference Grid cap is reached.
 */
export const getReferenceGridAvailableSlots = (
  outputs: readonly Pick<StudioOutput, "hiddenInReferenceGrid">[],
  maxVisibleItems = REFERENCE_GRID_MAX_VISIBLE_ITEMS
): number => Math.max(0, maxVisibleItems - countReferenceGridVisibleOutputs(outputs));

export type ReferenceGridLimitResult<T extends Pick<StudioOutput, "id" | "hiddenInReferenceGrid">> =
  {
    rows: T[];
    trimmedRows: T[];
    trimmedIds: string[];
    visibleCount: number;
    trimmedCount: number;
  };

/**
 * Keeps the first N visible outputs while preserving hidden rows and source order.
 */
export const limitReferenceGridVisibleOutputs = <
  T extends Pick<StudioOutput, "id" | "hiddenInReferenceGrid">,
>(
  rows: readonly T[],
  maxVisibleItems = REFERENCE_GRID_MAX_VISIBLE_ITEMS
): ReferenceGridLimitResult<T> => {
  const nextRows: T[] = [];
  const trimmedRows: T[] = [];
  const trimmedIds: string[] = [];
  let visibleCount = 0;

  rows.forEach((row) => {
    if (!isReferenceGridVisibleOutput(row)) {
      nextRows.push(row);
      return;
    }

    if (visibleCount < maxVisibleItems) {
      visibleCount += 1;
      nextRows.push(row);
      return;
    }

    trimmedRows.push(row);
    trimmedIds.push(row.id);
  });

  return {
    rows: nextRows,
    trimmedRows,
    trimmedIds,
    visibleCount,
    trimmedCount: trimmedIds.length,
  };
};

export const buildReferenceGridOverflowArchiveRows = (
  rows: readonly StudioOutput[],
  archivedAt = new Date().toISOString()
): StudioOutput[] =>
  rows.map((row) => ({
    ...row,
    archivedAt: row.archivedAt ?? archivedAt,
    archiveReason: row.archiveReason ?? "cleanup",
  }));

export const mergeReferenceGridArchivedRows = (
  archivedRows: readonly StudioOutput[],
  overflowRows: readonly StudioOutput[]
): StudioOutput[] => {
  if (!overflowRows.length) return [...archivedRows];
  const overflowIds = new Set(overflowRows.map((row) => row.id));
  return [...overflowRows, ...archivedRows.filter((row) => !overflowIds.has(row.id))];
};

export type ReferenceGridAdmissionResult<
  T extends Pick<StudioOutput, "id" | "hiddenInReferenceGrid">,
> = {
  admitted: T[];
  skipped: T[];
  availableVisibleSlots: number;
};

/**
 * Admits only the incoming visible outputs that fit without displacing existing rows.
 */
export const admitReferenceGridIncomingOutputs = <
  T extends Pick<StudioOutput, "id" | "hiddenInReferenceGrid">,
>(
  incoming: readonly T[],
  existing: readonly Pick<StudioOutput, "hiddenInReferenceGrid">[],
  maxVisibleItems = REFERENCE_GRID_MAX_VISIBLE_ITEMS
): ReferenceGridAdmissionResult<T> => {
  const availableVisibleSlots = getReferenceGridAvailableSlots(existing, maxVisibleItems);
  const admitted: T[] = [];
  const skipped: T[] = [];
  let usedVisibleSlots = 0;

  incoming.forEach((output) => {
    if (!isReferenceGridVisibleOutput(output)) {
      admitted.push(output);
      return;
    }

    if (usedVisibleSlots < availableVisibleSlots) {
      usedVisibleSlots += 1;
      admitted.push(output);
      return;
    }

    skipped.push(output);
  });

  return {
    admitted,
    skipped,
    availableVisibleSlots,
  };
};
