import type { StudioOutput } from "../types";

const asTrimmedString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseCreatedAtMs = (value: string | null | undefined): number | null => {
  const normalized = asTrimmedString(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

export const sortStudioOutputsByCreatedAtDesc = <T extends Pick<StudioOutput, "createdAt">>(
  rows: readonly T[]
): T[] => {
  if (rows.length <= 1) return [...rows];

  const indexedRows = rows.map((row, index) => ({
    row,
    index,
    createdAtMs: parseCreatedAtMs(row.createdAt),
  }));

  return indexedRows
    .sort((left, right) => {
      const leftCreatedAtMs = left.createdAtMs;
      const rightCreatedAtMs = right.createdAtMs;
      const leftHasCreatedAt = typeof leftCreatedAtMs === "number";
      const rightHasCreatedAt = typeof rightCreatedAtMs === "number";

      if (leftHasCreatedAt && rightHasCreatedAt && leftCreatedAtMs !== rightCreatedAtMs) {
        return rightCreatedAtMs - leftCreatedAtMs;
      }
      if (leftHasCreatedAt !== rightHasCreatedAt) {
        return leftHasCreatedAt ? -1 : 1;
      }
      return left.index - right.index;
    })
    .map(({ row }) => row);
};
