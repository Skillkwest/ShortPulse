/**
 * Shared Reference Grid active-workset limits.
 * Keeps server, session, and feature code aligned without importing UI feature internals.
 */

export type ReferenceGridVisibilityRow = {
  hiddenInReferenceGrid?: boolean | null;
};

export type ReferenceGridIdentifiedVisibilityRow = ReferenceGridVisibilityRow & {
  id: string;
};

export type ReferenceGridArchivableRow = {
  archivedAt?: string | null;
  archiveReason?: string | null;
};

export const REFERENCE_GRID_WARN_VISIBLE_ITEMS = 300;
export const REFERENCE_GRID_MAX_VISIBLE_ITEMS = 500;
export const REFERENCE_GRID_TARGET_TOTAL_ITEMS = 500;

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
export const isReferenceGridVisibleOutput = (output: ReferenceGridVisibilityRow): boolean =>
  output.hiddenInReferenceGrid !== true;

/**
 * Counts active outputs that can render in All Refs or Quick Slot.
 */
export const countReferenceGridVisibleOutputs = (
  outputs: readonly ReferenceGridVisibilityRow[]
): number =>
  outputs.reduce((count, output) => count + (isReferenceGridVisibleOutput(output) ? 1 : 0), 0);

/**
 * Returns the remaining visible slots before the Reference Grid cap is reached.
 */
export const getReferenceGridAvailableSlots = (
  outputs: readonly ReferenceGridVisibilityRow[],
  maxVisibleItems = REFERENCE_GRID_MAX_VISIBLE_ITEMS
): number => Math.max(0, maxVisibleItems - countReferenceGridVisibleOutputs(outputs));

export type ReferenceGridLimitResult<T extends ReferenceGridIdentifiedVisibilityRow> = {
  rows: T[];
  trimmedRows: T[];
  trimmedIds: string[];
  visibleCount: number;
  trimmedCount: number;
};

/**
 * Keeps the first N visible outputs while preserving hidden rows and source order.
 */
export const limitReferenceGridVisibleOutputs = <T extends ReferenceGridIdentifiedVisibilityRow>(
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

export const buildReferenceGridOverflowArchiveRows = <T extends ReferenceGridArchivableRow>(
  rows: readonly T[],
  archivedAt: string | null = new Date().toISOString()
): T[] =>
  rows.map((row) => ({
    ...row,
    archivedAt: row.archivedAt ?? archivedAt,
    archiveReason: row.archiveReason ?? "cleanup",
  }));

export const mergeReferenceGridArchivedRows = <T extends ReferenceGridIdentifiedVisibilityRow>(
  archivedRows: readonly T[],
  overflowRows: readonly T[]
): T[] => {
  if (!overflowRows.length) return [...archivedRows];
  const overflowIds = new Set(overflowRows.map((row) => row.id));
  return [...overflowRows, ...archivedRows.filter((row) => !overflowIds.has(row.id))];
};

export type ReferenceGridAdmissionResult<T extends ReferenceGridVisibilityRow> = {
  admitted: T[];
  skipped: T[];
  availableVisibleSlots: number;
};

/**
 * Admits only the incoming visible outputs that fit without displacing existing rows.
 */
export const admitReferenceGridIncomingOutputs = <T extends ReferenceGridVisibilityRow>(
  incoming: readonly T[],
  existing: readonly ReferenceGridVisibilityRow[],
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
