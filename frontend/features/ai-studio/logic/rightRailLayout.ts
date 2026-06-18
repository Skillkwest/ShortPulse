/**
 * AI Studio right-rail layout snapshot helpers.
 * Owns the tiny project-durable layout contract for global rail visibility and split ratios.
 */

export type AiStudioRightRailLayoutV1 = {
  schemaVersion: 1;
  panels: {
    canvas: boolean;
    quickSlot: boolean;
    referenceGrid: boolean;
  };
  splits: {
    canvasInventoryTopRatio: number | null;
    quickSlotReferenceTopRatio: number | null;
  };
};

const MIN_SPLIT_RATIO = 0.01;
const MAX_SPLIT_RATIO = 0.99;

/**
 * Creates the canonical default global right-rail layout.
 */
export const createDefaultRightRailLayout = (): AiStudioRightRailLayoutV1 => ({
  schemaVersion: 1,
  panels: {
    canvas: false,
    quickSlot: true,
    referenceGrid: true,
  },
  splits: {
    canvasInventoryTopRatio: null,
    quickSlotReferenceTopRatio: null,
  },
});

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const sanitizeBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const sanitizeSplitRatio = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value));
};

/**
 * Sanitizes an unknown project snapshot value into the supported right-rail layout contract.
 */
export const sanitizeRightRailLayoutSnapshot = (value: unknown): AiStudioRightRailLayoutV1 => {
  const defaults = createDefaultRightRailLayout();
  const record = asRecord(value);
  const panels = asRecord(record.panels);
  const splits = asRecord(record.splits);

  return {
    schemaVersion: 1,
    panels: {
      canvas: sanitizeBoolean(panels.canvas, defaults.panels.canvas),
      quickSlot: sanitizeBoolean(panels.quickSlot, defaults.panels.quickSlot),
      referenceGrid: sanitizeBoolean(panels.referenceGrid, defaults.panels.referenceGrid),
    },
    splits: {
      canvasInventoryTopRatio: sanitizeSplitRatio(splits.canvasInventoryTopRatio),
      quickSlotReferenceTopRatio: sanitizeSplitRatio(splits.quickSlotReferenceTopRatio),
    },
  };
};

/**
 * Returns a stable JSON signature for restore/autosave comparisons.
 */
export const createRightRailLayoutSignature = (value: unknown): string =>
  JSON.stringify(sanitizeRightRailLayoutSnapshot(value));
