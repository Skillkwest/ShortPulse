/**
 * Helpers for applying move-operation results to tabbed Media Library cache state.
 * Keeps tab queries and row ordering intact while invalidating stale tab snapshots.
 */
import {
  MEDIA_DATA_TABS,
  mergePageRows,
  normalizeMediaSearchTerm,
  type MediaDataTab,
  type MediaTabCache,
} from "./mediaLibraryPageHelpers";

type MoveCacheRow = {
  id: string;
  filename?: string | null;
  storage_path?: string | null;
  created_at?: string | null;
};

type MediaTabCacheState<TRow extends MoveCacheRow> = Record<MediaDataTab, MediaTabCache<TRow>>;

type ApplyMovedRowsToMediaTabCacheArgs<TRow extends MoveCacheRow> = {
  cacheState: MediaTabCacheState<TRow>;
  movedRows: TRow[];
  destinationTab: MediaDataTab;
  nowMs?: number;
};

/**
 * Applies moved rows across all media tab caches.
 * Inputs: current cache snapshot, moved rows, and destination tab.
 * Output: next cache snapshot with moved rows removed from old tabs and merged into destination tab.
 * Side effects: none.
 */
export const applyMovedRowsToMediaTabCache = <TRow extends MoveCacheRow>({
  cacheState,
  movedRows,
  destinationTab,
  nowMs = Date.now(),
}: ApplyMovedRowsToMediaTabCacheArgs<TRow>): MediaTabCacheState<TRow> => {
  if (!movedRows.length) return cacheState;

  const movedById = new Map(movedRows.map((row) => [row.id, row]));
  const next = { ...cacheState };

  for (const tab of MEDIA_DATA_TABS) {
    const cache = cacheState[tab];
    const rowsWithoutMoved = cache.rows.filter((row) => !movedById.has(row.id));
    let nextRows = rowsWithoutMoved;

    if (tab === destinationTab) {
      const query = normalizeMediaSearchTerm(cache.query).toLowerCase();
      const queryMatchedRows = movedRows.filter((row) => {
        const filename = row.filename?.toLowerCase() ?? "";
        const path = row.storage_path?.toLowerCase() ?? "";
        return !query || filename.includes(query) || path.includes(query);
      });
      if (queryMatchedRows.length) {
        nextRows = mergePageRows(rowsWithoutMoved, queryMatchedRows);
      }
    }

    next[tab] = {
      ...cache,
      rows: nextRows,
      loadedAtMs: tab === destinationTab ? nowMs : null,
    };
  }

  return next;
};
