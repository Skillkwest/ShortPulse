import { getMediaDataTabForRow, type MediaDataTab } from "./mediaLibraryPageHelpers";

type VisibleMediaRow = {
  filename?: string | null;
  file_type: string;
  source?: string | null;
  storage_path: string;
};

type ResolveVisibleMediaRowsArgs<TRow extends VisibleMediaRow> = {
  rows: TRow[];
  activeMediaTab: MediaDataTab | null;
  activeMediaQuery: string;
  cachedMediaQuery: string | null | undefined;
};

export const resolveVisibleMediaRows = <TRow extends VisibleMediaRow>({
  rows,
  activeMediaTab,
  activeMediaQuery,
  cachedMediaQuery,
}: ResolveVisibleMediaRowsArgs<TRow>): TRow[] => {
  if (!activeMediaTab) return [];

  const tabRows = rows.filter((row) => getMediaDataTabForRow(row) === activeMediaTab);
  const normalizedQuery = activeMediaQuery.trim().toLowerCase();
  if (!normalizedQuery) return tabRows;

  const cacheMatchesActiveQuery = (cachedMediaQuery ?? "").trim() === activeMediaQuery.trim();
  if (cacheMatchesActiveQuery) {
    return tabRows;
  }

  return tabRows.filter((row) => {
    const name = row.filename?.toLowerCase() ?? "";
    const path = row.storage_path?.toLowerCase() ?? "";
    return name.includes(normalizedQuery) || path.includes(normalizedQuery);
  });
};
