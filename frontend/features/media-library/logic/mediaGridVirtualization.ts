/**
 * Shared masonry virtualization math for Media Library modal + panel grids.
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
};

export type ComputeMediaVirtualLayoutArgs = {
  items: MediaVirtualItem[];
  containerWidth: number;
  viewportTop: number;
  viewportHeight: number;
  targetColumnWidth: number;
  gap: number;
  overscanPx: number;
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
  gap,
}: {
  containerWidth: number;
  targetColumnWidth: number;
  gap: number;
}): number => {
  const safeWidth = toFinitePositive(containerWidth, 0);
  if (safeWidth <= 0) return 1;
  const safeTargetWidth = Math.max(120, Math.floor(toFinitePositive(targetColumnWidth, 240)));
  const safeGap = Math.max(0, Math.floor(toFinitePositive(gap, 0)));
  const count = Math.floor((safeWidth + safeGap) / (safeTargetWidth + safeGap));
  return Math.max(1, count);
};

/**
 * Computes absolute-positioned masonry coordinates for the full item set.
 */
export const computeMediaVirtualLayoutFrame = ({
  items,
  containerWidth,
  targetColumnWidth,
  gap,
}: Omit<
  ComputeMediaVirtualLayoutArgs,
  "viewportTop" | "viewportHeight" | "overscanPx"
>): MediaVirtualLayoutFrame => {
  const columnCount = resolveColumnCount({
    containerWidth,
    targetColumnWidth,
    gap,
  });
  const safeGap = Math.max(0, toFinitePositive(gap, 0));
  const columnWidth = Math.max(
    1,
    (toFinitePositive(containerWidth, 1) - safeGap * (columnCount - 1)) / columnCount
  );
  const columnHeights = new Array<number>(columnCount).fill(0);
  const layoutItems: MediaVirtualLayoutItem[] = [];

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

  return {
    columnCount,
    columnWidth,
    totalHeight,
    items: layoutItems,
  };
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
  return layout.items.filter((item) => item.bottom >= visibleStart && item.top <= visibleEnd);
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
  gap,
  overscanPx,
}: ComputeMediaVirtualLayoutArgs): MediaVirtualLayoutResult => {
  const layout = computeMediaVirtualLayoutFrame({
    items,
    containerWidth,
    targetColumnWidth,
    gap,
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
