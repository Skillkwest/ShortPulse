/**
 * Project workspace Quick Slot diagnostics.
 * Builds sanitized low-cardinality summaries for save/load persistence tracing.
 */
import type { AiStudioSessionSnapshot } from "./sessionSnapshot";

type SnapshotLike = {
  outputs?: {
    active?: unknown;
    archived?: unknown;
    curatedReferenceIds?: unknown;
    removedFromAllRefsIds?: unknown;
  } | null;
  canvas?: unknown;
};

export type ProjectWorkspaceQuickSlotDiagnostics = {
  active_count: number;
  archived_count: number;
  quick_slot_count: number;
  removed_from_refs_count: number;
  quick_slot_missing_count: number;
  quick_slot_missing_ids: string;
  quick_slot_ids: string;
  active_ids: string;
  quick_slot_library_count: number;
  quick_slot_generated_count: number;
  quick_slot_saved_media_count: number;
  quick_slot_saved_media_ids_total: number;
  canvas_item_count: number;
};

const MAX_ID_SAMPLE = 8;
const MAX_ID_LENGTH = 48;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asRows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(asRecord) : [];

const asStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry): entry is string => entry.length > 0)
    : [];

const compactId = (value: string): string => {
  if (value.length <= MAX_ID_LENGTH) return value;
  return `${value.slice(0, MAX_ID_LENGTH - 1)}…`;
};

const sampleIds = (ids: readonly string[]): string =>
  ids.slice(0, MAX_ID_SAMPLE).map(compactId).join("|");

const resolveCanvasItemCount = (snapshot: SnapshotLike): number => {
  const canvas = asRecord(snapshot.canvas);
  const scene = asRecord(canvas.scene);
  const items = scene.items;
  return Array.isArray(items) ? items.length : 0;
};

/**
 * Summarizes Quick Slot persistence state without media URLs or user-authored content.
 */
export const buildProjectWorkspaceQuickSlotDiagnostics = (
  snapshot: AiStudioSessionSnapshot | SnapshotLike | null | undefined
): ProjectWorkspaceQuickSlotDiagnostics => {
  const outputs = asRecord(snapshot?.outputs);
  const activeRows = asRows(outputs.active);
  const archivedRows = asRows(outputs.archived);
  const allRows = [...activeRows, ...archivedRows];
  const rowById = new Map<string, Record<string, unknown>>();
  const activeIds = activeRows
    .map((row) => (typeof row.id === "string" ? row.id.trim() : ""))
    .filter((id): id is string => id.length > 0);
  allRows.forEach((row) => {
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (id) rowById.set(id, row);
  });

  const quickSlotIds = asStringList(outputs.curatedReferenceIds);
  const missingQuickSlotIds = quickSlotIds.filter((id) => !rowById.has(id));
  let libraryCount = 0;
  let generatedCount = 0;
  let quickSlotSavedMediaCount = 0;
  let quickSlotSavedMediaIdsTotal = 0;

  quickSlotIds.forEach((id) => {
    const row = rowById.get(id);
    if (!row) return;
    const mediaSource =
      typeof row.mediaSource === "string" ? row.mediaSource.trim().toLowerCase() : "";
    if (mediaSource === "library") libraryCount += 1;
    if (mediaSource === "generated") generatedCount += 1;
    const savedMediaIds = asStringList(row.savedMediaIds);
    if (savedMediaIds.length > 0) {
      quickSlotSavedMediaCount += 1;
      quickSlotSavedMediaIdsTotal += savedMediaIds.length;
    }
  });

  return {
    active_count: activeRows.length,
    archived_count: archivedRows.length,
    quick_slot_count: quickSlotIds.length,
    removed_from_refs_count: asStringList(outputs.removedFromAllRefsIds).length,
    quick_slot_missing_count: missingQuickSlotIds.length,
    quick_slot_missing_ids: sampleIds(missingQuickSlotIds),
    quick_slot_ids: sampleIds(quickSlotIds),
    active_ids: sampleIds(activeIds),
    quick_slot_library_count: libraryCount,
    quick_slot_generated_count: generatedCount,
    quick_slot_saved_media_count: quickSlotSavedMediaCount,
    quick_slot_saved_media_ids_total: quickSlotSavedMediaIdsTotal,
    canvas_item_count: snapshot ? resolveCanvasItemCount(snapshot) : 0,
  };
};

export const shouldReportProjectWorkspaceQuickSlotDiagnostics = (
  diagnostics: ProjectWorkspaceQuickSlotDiagnostics
): boolean => diagnostics.quick_slot_count > 0 || diagnostics.quick_slot_missing_count > 0;

export const prefixProjectWorkspaceQuickSlotDiagnostics = (
  prefix: string,
  diagnostics: ProjectWorkspaceQuickSlotDiagnostics
): Record<string, string | number> =>
  Object.fromEntries(
    Object.entries(diagnostics).map(([key, value]) => [`${prefix}_${key}`, value])
  );
