/**
 * Assistant-message editing helpers.
 * Centralizes normalization and no-op rejection for local-only inline bubble edits.
 */

/**
 * Normalizes user-entered assistant message edit text.
 */
export const normalizeAssistantMessageEditContent = (value: string): string =>
  value.replace(/\r\n?/g, "\n").trim();

/**
 * Resolves whether an edit should be committed and returns the committed content when changed.
 */
export const resolveAssistantMessageEditCommit = ({
  currentContent,
  nextContent,
}: {
  currentContent: string;
  nextContent: string;
}): string | null => {
  const normalizedCurrent = normalizeAssistantMessageEditContent(currentContent);
  const normalizedNext = normalizeAssistantMessageEditContent(nextContent);
  if (!normalizedNext) return null;
  if (normalizedNext === normalizedCurrent) return null;
  return normalizedNext;
};
