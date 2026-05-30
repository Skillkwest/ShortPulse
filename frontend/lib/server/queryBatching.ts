/**
 * Shared helpers for batching server-side `.in(...)` queries into stable chunk sizes.
 */

export const DEFAULT_DB_IN_CLAUSE_BATCH_SIZE = 100;

/**
 * Splits a list into ordered chunks for bounded database `IN` queries.
 */
export const chunkValues = <T>(
  values: readonly T[],
  size = DEFAULT_DB_IN_CLAUSE_BATCH_SIZE
): T[][] => {
  if (size <= 0) return [Array.from(values)];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};
