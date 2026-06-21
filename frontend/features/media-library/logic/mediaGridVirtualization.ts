/**
 * Shared masonry virtualization math for Media Library panel grids.
 * Keeps layout computation deterministic and React-agnostic.
 */

export type MediaVirtualItem = {
  id: string;
  aspectRatio: number;
};

export type MediaVirtualLayoutItem = {
  id: string;
  index: number;
  column: number;
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
};

export type MediaVirtualLayoutResult = {
  columnCount: number;
  columnWidth: number;
  totalHeight: number;
  visibleItems: MediaVirtualLayoutItem[];
};

export type MediaVirtualLayoutFrame = {
  columnCount: number;
  columnWidth: number;
  totalHeight: number;
  items: MediaVirtualLayoutItem[];
  itemsByTop: MediaVirtualLayoutItem[];
  itemsByBottom: MediaVirtualLayoutItem[];
};

export type MediaVirtualLayoutMode = "masonry" | "chronological-grid";

export type ComputeMediaVirtualLayoutArgs = {
  items: MediaVirtualItem[];
  containerWidth: number;
  viewportTop: number;
  viewportHeight: number;
  targetColumnWidth: number;
  maxColumnCount?: number;
  gap: number;
  overscanPx: number;
  layoutMode?: MediaVirtualLayoutMode;
};

export type ResolveMediaVirtualWindowArgs = {
  layout: MediaVirtualLayoutFrame;
  viewportTop: number;
  viewportHeight: number;
  overscanPx: number;
};

const MIN_ASPECT_RATIO = 0.2;
const MAX_ASPECT_RATIO = 4;

const toFinitePositive = (value: number, fallback: number): number =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const clampAspectRatio = (value: number): number => {
  const normalized = toFinitePositive(value, 1);
  if (normalized < MIN_ASPECT_RATIO) return MIN_ASPECT_RATIO;
  if (normalized > MAX_ASPECT_RATIO) return MAX_ASPECT_RATIO;
  return normalized;
};

const resolveColumnCount = ({
  containerWidth,
  targetColumnWidth,
  maxColumnCount,
  gap,
}: {
  containerWidth: number;
  targetColumnWidth: number;
  maxColumnCount?: number;
  gap: number;
}): number => {
  const safeWidth = toFinitePositive(containerWidth, 0);
  if (safeWidth <= 0) return 1;
  const safeTargetWidth = Math.max(120, Math.floor(toFinitePositive(targetColumnWidth, 240)));
  const safeGap = Math.max(0, Math.floor(toFinitePositive(gap, 0)));
  const count = Math.floor((safeWidth + safeGap) / (safeTargetWidth + safeGap));
  const uncappedCount = Math.max(1, count);
  if (!Number.isFinite(maxColumnCount) || maxColumnCount == null || maxColumnCount <= 0) {
    return uncappedCount;
  }
  return Math.min(uncappedCount, Math.max(1, Math.floor(maxColumnCount)));
};

const createVirtualLayoutFrame = ({
  columnCount,
  columnWidth,
  totalHeight,
  items,
}: Omit<MediaVirtualLayoutFrame, "itemsByTop" | "itemsByBottom">): MediaVirtualLayoutFrame => ({
  columnCount,
  columnWidth,
  totalHeight,
  items,
  itemsByTop: [...items].sort((left, right) => left.top - right.top || left.index - right.index),
  itemsByBottom: [...items].sort(
    (left, right) => left.bottom - right.bottom || left.index - right.index
  ),
});

/**
 * Computes absolute-positioned masonry coordinates for the full item set.
 */
export const computeMediaVirtualLayoutFrame = ({
  items,
  containerWidth,
  targetColumnWidth,
  maxColumnCount,
  gap,
  layoutMode = "masonry",
}: Omit<
  ComputeMediaVirtualLayoutArgs,
  "viewportTop" | "viewportHeight" | "overscanPx"
>): MediaVirtualLayoutFrame => {
  const columnCount = resolveColumnCount({
    containerWidth,
    targetColumnWidth,
    maxColumnCount,
    gap,
  });
  const safeGap = Math.max(0, toFinitePositive(gap, 0));
  const columnWidth = Math.max(
    1,
    (toFinitePositive(containerWidth, 1) - safeGap * (columnCount - 1)) / columnCount
  );
  const layoutItems: MediaVirtualLayoutItem[] = [];

  if (layoutMode === "chronological-grid") {
    let rowTop = 0;
    for (let rowStart = 0; rowStart < items.length; rowStart += columnCount) {
      const rowItems = items.slice(rowStart, rowStart + columnCount);
      const rowHeights = rowItems.map((item) => columnWidth / clampAspectRatio(item.aspectRatio));
      const rowHeight = rowHeights.length ? Math.max(...rowHeights) : 0;
      for (let column = 0; column < rowItems.length; column += 1) {
        const item = rowItems[column];
        const index = rowStart + column;
        const itemHeight = rowHeights[column] ?? columnWidth;
        const left = column * (columnWidth + safeGap);
        layoutItems.push({
          id: item.id,
          index,
          column,
          top: rowTop,
          left,
          width: columnWidth,
          height: itemHeight,
          bottom: rowTop + itemHeight,
        });
      }
      rowTop += rowHeight + safeGap;
    }

    return createVirtualLayoutFrame({
      columnCount,
      columnWidth,
      totalHeight: Math.max(0, rowTop - safeGap),
      items: layoutItems,
    });
  }

  const columnHeights = new Array<number>(columnCount).fill(0);
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    let targetColumn = 0;
    let minHeight = columnHeights[0] ?? 0;
    for (let column = 1; column < columnCount; column += 1) {
      const height = columnHeights[column] ?? 0;
      if (height < minHeight) {
        minHeight = height;
        targetColumn = column;
      }
    }

    const aspectRatio = clampAspectRatio(item.aspectRatio);
    const itemHeight = columnWidth / aspectRatio;
    const top = columnHeights[targetColumn] ?? 0;
    const left = targetColumn * (columnWidth + safeGap);
    const bottom = top + itemHeight;
    columnHeights[targetColumn] = bottom + safeGap;

    layoutItems.push({
      id: item.id,
      index,
      column: targetColumn,
      top,
      left,
      width: columnWidth,
      height: itemHeight,
      bottom,
    });
  }

  const rawTotalHeight = columnHeights.length ? Math.max(...columnHeights) - safeGap : 0;
  const totalHeight = Math.max(0, rawTotalHeight);

  return createVirtualLayoutFrame({
    columnCount,
    columnWidth,
    totalHeight,
    items: layoutItems,
  });
};

const findFirstBottomAtOrAfter = (
  itemsByBottom: MediaVirtualLayoutItem[],
  visibleStart: number
): number => {
  let low = 0;
  let high = itemsByBottom.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((itemsByBottom[middle]?.bottom ?? 0) < visibleStart) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

const findFirstTopAfter = (itemsByTop: MediaVirtualLayoutItem[], visibleEnd: number): number => {
  let low = 0;
  let high = itemsByTop.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((itemsByTop[middle]?.top ?? 0) <= visibleEnd) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

/**
 * Resolves the visible masonry slice for the current viewport from a precomputed layout frame.
 */
export const resolveVisibleMediaVirtualItems = ({
  layout,
  viewportTop,
  viewportHeight,
  overscanPx,
}: ResolveMediaVirtualWindowArgs): MediaVirtualLayoutItem[] => {
  const safeViewportTop = Math.max(0, toFinitePositive(viewportTop, 0));
  const safeViewportHeight = Math.max(0, toFinitePositive(viewportHeight, 0));
  const safeOverscan = Math.max(0, toFinitePositive(overscanPx, 0));
  const visibleStart = Math.max(0, safeViewportTop - safeOverscan);
  const visibleEnd = safeViewportTop + safeViewportHeight + safeOverscan;
  if (!layout.itemsByTop.length || !layout.itemsByBottom.length) {
    return layout.items.filter((item) => item.bottom >= visibleStart && item.top <= visibleEnd);
  }

  const itemsByTop = layout.itemsByTop;
  const itemsByBottom = layout.itemsByBottom;
  const topEndIndex = findFirstTopAfter(itemsByTop, visibleEnd);
  const bottomStartIndex = findFirstBottomAtOrAfter(itemsByBottom, visibleStart);
  const topCandidateCount = topEndIndex;
  const bottomCandidateCount = itemsByBottom.length - bottomStartIndex;
  const candidates =
    topCandidateCount <= bottomCandidateCount
      ? itemsByTop.slice(0, topEndIndex)
      : itemsByBottom.slice(bottomStartIndex);

  return candidates
    .filter((item) => item.bottom >= visibleStart && item.top <= visibleEnd)
    .sort((left, right) => left.index - right.index);
};

/**
 * Computes absolute-positioned masonry coordinates and a virtualized visible slice.
 */
export const computeMediaVirtualLayout = ({
  items,
  containerWidth,
  viewportTop,
  viewportHeight,
  targetColumnWidth,
  maxColumnCount,
  gap,
  overscanPx,
  layoutMode,
}: ComputeMediaVirtualLayoutArgs): MediaVirtualLayoutResult => {
  const layout = computeMediaVirtualLayoutFrame({
    items,
    containerWidth,
    targetColumnWidth,
    maxColumnCount,
    gap,
    layoutMode,
  });

  return {
    columnCount: layout.columnCount,
    columnWidth: layout.columnWidth,
    totalHeight: layout.totalHeight,
    visibleItems: resolveVisibleMediaVirtualItems({
      layout,
      viewportTop,
      viewportHeight,
      overscanPx,
    }),
  };
};
