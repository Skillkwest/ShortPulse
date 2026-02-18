/**
 * Reference-grid virtualization helpers.
 * Keeps window-range math deterministic and unit-testable.
 */
export const REFERENCE_GRID_VIRTUALIZE_MIN_ITEMS = 12;

type ReferenceGridWindowInput = {
  itemCount: number;
  columnCount: number;
  rowHeight: number;
  scrollTop: number;
  viewportHeight: number;
  overscanRows: number;
  virtualizeMinItems?: number;
};

export type ReferenceGridWindow = {
  shouldVirtualize: boolean;
  totalRows: number;
  startRow: number;
  endRow: number;
  startIndex: number;
  endIndex: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
};

/**
 * Resolves adaptive overscan rows for the current reference-grid density.
 */
export const resolveReferenceGridOverscanRows = (
  itemCount: number,
  options?: { pressureLevel?: number }
): number => {
  const pressureLevel = options?.pressureLevel ?? 0;
  if (itemCount < 40) return 2;
  if (itemCount <= 120) return pressureLevel >= 2 ? 0 : 1;
  if (pressureLevel >= 1) return 0;
  return 1;
};

/**
 * Computes the visible row/index window and spacer heights for grid virtualization.
 */
export const calculateReferenceGridWindow = ({
  itemCount,
  columnCount,
  rowHeight,
  scrollTop,
  viewportHeight,
  overscanRows,
  virtualizeMinItems = REFERENCE_GRID_VIRTUALIZE_MIN_ITEMS,
}: ReferenceGridWindowInput): ReferenceGridWindow => {
  const safeItemCount = Math.max(0, Math.floor(itemCount));
  const safeColumns = Math.max(1, Math.floor(columnCount));
  const safeRowHeight = Math.max(1, rowHeight);
  const safeScrollTop = Math.max(0, scrollTop);
  const safeViewportHeight = Math.max(safeRowHeight, viewportHeight);
  const safeOverscanRows = Math.max(0, Math.floor(overscanRows));
  const shouldVirtualize = safeItemCount >= Math.max(1, Math.floor(virtualizeMinItems));

  const totalRows = Math.max(1, Math.ceil(safeItemCount / safeColumns));
  const startRow = shouldVirtualize
    ? Math.min(
        totalRows - 1,
        Math.max(0, Math.floor(safeScrollTop / safeRowHeight) - safeOverscanRows)
      )
    : 0;
  const endRow = shouldVirtualize
    ? Math.min(
        totalRows - 1,
        Math.ceil((safeScrollTop + safeViewportHeight) / safeRowHeight) + safeOverscanRows
      )
    : totalRows - 1;

  const startIndex = Math.max(0, startRow * safeColumns);
  const endIndex = Math.min(safeItemCount, (endRow + 1) * safeColumns);

  return {
    shouldVirtualize,
    totalRows,
    startRow,
    endRow,
    startIndex,
    endIndex,
    topSpacerHeight: shouldVirtualize ? startRow * safeRowHeight : 0,
    bottomSpacerHeight: shouldVirtualize
      ? Math.max(0, (totalRows - endRow - 1) * safeRowHeight)
      : 0,
  };
};
