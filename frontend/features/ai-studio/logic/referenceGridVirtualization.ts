/**
 * Reference-grid virtualization helpers.
 * Keeps window-range math deterministic and unit-testable.
 */
export const REFERENCE_GRID_VIRTUALIZE_MIN_ITEMS = 12;
const REFERENCE_GRID_MIN_COLUMNS = 2;

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

type ResolveReferenceGridMaxColumnsInput = {
  requestedMaxColumns: number;
  itemCount: number;
  pressureLevel?: number;
};

type ReferenceGridPrependAnchorInput = {
  previousOutputIds: readonly string[];
  nextOutputIds: readonly string[];
  previousScrollTop: number;
  measuredScrollTop: number;
  previousColumnCount: number;
  nextColumnCount: number;
  previousRowHeight: number;
  nextRowHeight: number;
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
  if (itemCount < 60) return 0;
  if (itemCount <= 120) return pressureLevel >= 2 ? 0 : 1;
  if (pressureLevel >= 1) return 0;
  return 1;
};

/**
 * Caps max columns under high-density loads to keep render cost stable in wide layouts.
 */
export const resolveReferenceGridMaxColumns = ({
  requestedMaxColumns,
  itemCount,
  pressureLevel = 0,
}: ResolveReferenceGridMaxColumnsInput): number => {
  const safeRequested = Math.max(REFERENCE_GRID_MIN_COLUMNS, Math.floor(requestedMaxColumns));
  if (itemCount < 40) return safeRequested;
  const highDensityCap = pressureLevel >= 2 ? 3 : 4;
  return Math.max(REFERENCE_GRID_MIN_COLUMNS, Math.min(safeRequested, highDensityCap));
};

/**
 * Preserves the user's viewport anchor when new outputs are prepended ahead of the current window.
 */
export const resolveReferenceGridPrependAnchorScrollTop = ({
  previousOutputIds,
  nextOutputIds,
  previousScrollTop,
  measuredScrollTop,
  previousColumnCount,
  nextColumnCount,
  previousRowHeight,
  nextRowHeight,
}: ReferenceGridPrependAnchorInput): number | null => {
  if (nextOutputIds.length <= previousOutputIds.length || previousOutputIds.length === 0) {
    return null;
  }

  const previousFirstOutputId = previousOutputIds[0];
  if (!previousFirstOutputId) return null;
  const prependedItemCount = nextOutputIds.indexOf(previousFirstOutputId);
  if (prependedItemCount <= 0) return null;

  const safePreviousScrollTop = Math.max(0, previousScrollTop);
  const safeMeasuredScrollTop = Math.max(0, measuredScrollTop);
  // Trust the live DOM scroll position when the browser is already at the top.
  // Cached virtualization metrics can lag within the first row and would otherwise
  // incorrectly preserve a stale offset after prepending a new output.
  if (safeMeasuredScrollTop <= 1) {
    return 0;
  }
  if (safePreviousScrollTop <= 1) {
    return 0;
  }

  const safePreviousColumnCount = Math.max(1, Math.floor(previousColumnCount));
  const safeNextColumnCount = Math.max(1, Math.floor(nextColumnCount));
  const safePreviousRowHeight = Math.max(1, previousRowHeight);
  const safeNextRowHeight = Math.max(1, nextRowHeight);
  const previousRow = Math.floor(safePreviousScrollTop / safePreviousRowHeight);
  const previousRowOffsetRatio =
    (safePreviousScrollTop - previousRow * safePreviousRowHeight) / safePreviousRowHeight;
  const previousFirstVisibleIndex = previousRow * safePreviousColumnCount;
  const nextFirstVisibleIndex = previousFirstVisibleIndex + prependedItemCount;
  const nextFirstVisibleRow = Math.floor(nextFirstVisibleIndex / safeNextColumnCount);
  const anchoredScrollTop =
    nextFirstVisibleRow * safeNextRowHeight + previousRowOffsetRatio * safeNextRowHeight;
  const expectedDelta = anchoredScrollTop - safePreviousScrollTop;
  const measuredDelta = safeMeasuredScrollTop - safePreviousScrollTop;

  if (Math.abs(measuredDelta - expectedDelta) < 1) {
    return safeMeasuredScrollTop;
  }

  return anchoredScrollTop;
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
