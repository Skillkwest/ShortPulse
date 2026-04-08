/**
 * Shared prompt-token insertion helpers.
 * Inserts token text into controlled prompt fields while preserving readable spacing.
 */

export const insertPromptTokenAtSelection = ({
  prompt,
  token,
  selectionStart,
  selectionEnd,
}: {
  prompt: string;
  token: string;
  selectionStart: number;
  selectionEnd: number;
}): { prompt: string; caret: number } => {
  const sourcePrompt = typeof prompt === "string" ? prompt : "";
  const start = Math.max(0, Math.min(sourcePrompt.length, selectionStart));
  const end = Math.max(start, Math.min(sourcePrompt.length, selectionEnd));
  const before = sourcePrompt.slice(0, start);
  const after = sourcePrompt.slice(end);
  const needsLeadingSpace = Boolean(before.length && !/\s$/.test(before));
  const needsTrailingSpace = Boolean(!/^\s/.test(after));
  const inserted = `${needsLeadingSpace ? " " : ""}${token}${needsTrailingSpace ? " " : ""}`;
  const nextPrompt = `${before}${inserted}${after}`;
  return {
    prompt: nextPrompt,
    caret: before.length + inserted.length,
  };
};
