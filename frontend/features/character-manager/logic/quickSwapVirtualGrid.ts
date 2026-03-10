/**
 * Virtual-grid window helpers for QuickSwap active/archive surfaces.
 * Computes visible ranges and spacer sizes for scroll-windowed rendering.
 */

export type VirtualGridWindowInput = {
  itemCount: number;
  columnCount: number;
  viewportHeight: number;
  scrollTop: number;
  rowHeight: number;
  rowGap: number;
  overscanRows: number;
};

export type VirtualGridWindow = {
  startIndex: number;
  endIndexExclusive: number;
  paddingTop: number;
  paddingBottom: number;
};

const toFiniteNonNegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

/**
 * Resolves visible indices and top/bottom spacer heights for a virtualized grid.
 */
export const resolveVirtualGridWindow = ({
  itemCount,
  columnCount,
  viewportHeight,
  scrollTop,
  rowHeight,
  rowGap,
  overscanRows,
}: VirtualGridWindowInput): VirtualGridWindow => {
  const totalItems = Math.max(0, Math.floor(itemCount));
  if (totalItems === 0) {
    return {
      startIndex: 0,
      endIndexExclusive: 0,
      paddingTop: 0,
      paddingBottom: 0,
    };
  }

  const columns = Math.max(1, Math.floor(columnCount));
  const heightPerRow = Math.max(1, toFiniteNonNegative(rowHeight));
  const gapPerRow = toFiniteNonNegative(rowGap);
  const viewport = toFiniteNonNegative(viewportHeight);
  const top = toFiniteNonNegative(scrollTop);
  const overscan = Math.max(0, Math.floor(overscanRows));
  const totalRows = Math.ceil(totalItems / columns);
  const rowStride = heightPerRow + gapPerRow;
  const firstVisibleRow = Math.min(totalRows - 1, Math.floor(top / rowStride));
  const visibleRowCount = Math.max(1, Math.ceil((viewport + gapPerRow) / rowStride));
  const startRow = Math.max(0, firstVisibleRow - overscan);
  const endRow = Math.min(totalRows - 1, firstVisibleRow + visibleRowCount - 1 + overscan);

  const startIndex = startRow * columns;
  const endIndexExclusive = Math.min(totalItems, (endRow + 1) * columns);
  const paddingTop = startRow * rowStride;
  const totalContentHeight = totalRows * heightPerRow + Math.max(0, totalRows - 1) * gapPerRow;
  const visibleRows = endRow - startRow + 1;
  const visibleContentHeight =
    visibleRows * heightPerRow + Math.max(0, visibleRows - 1) * gapPerRow;
  const paddingBottom = Math.max(0, totalContentHeight - paddingTop - visibleContentHeight);

  return {
    startIndex,
    endIndexExclusive,
    paddingTop,
    paddingBottom,
  };
};

/**
 * Returns stable absolute-index entries for a virtualized grid slice.
 */
export const sliceVirtualGridEntries = <T>(
  items: readonly T[],
  startIndex: number,
  endIndexExclusive: number
): Array<{ item: T; absoluteIndex: number }> => {
  const start = Math.max(0, Math.floor(startIndex));
  const end = Math.max(start, Math.floor(endIndexExclusive));
  return items.slice(start, end).map((item, index) => ({
    item,
    absoluteIndex: start + index,
  }));
};
