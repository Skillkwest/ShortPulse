/**
 * Validation helpers for admin-managed Create Pulse built-in preset drafts.
 */
type PulseDraftValidationInput = {
  label: string;
  systemInstructions: string;
};

export const isPulseDraftBlank = (draft: PulseDraftValidationInput): boolean =>
  draft.label.trim().length === 0 && draft.systemInstructions.trim().length === 0;

export const isPulseDraftPersistable = (draft: PulseDraftValidationInput): boolean =>
  draft.label.trim().length > 0 && draft.systemInstructions.trim().length > 0;

export const resolvePulseDraftValidationIssue = (
  draft: PulseDraftValidationInput
): string | null => {
  if (isPulseDraftBlank(draft)) return null;
  if (!draft.label.trim()) return "Title is required.";
  if (!draft.systemInstructions.trim()) return "Prompt is required.";
  return null;
};
