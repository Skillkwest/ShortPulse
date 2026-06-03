/**
 * Shared Create composer empty-state helpers.
 * Keeps the Standard and Pulse blank-shell ownership rule aligned.
 */

type ResolveCreateComposerNoHistoryShellParams = {
  hasVisibleAgentMessages: boolean;
};

const BANNED_CREATE_INLINE_GUARDRAIL_COPY = new Set(["Enter a prompt to generate."]);

/**
 * Returns whether the Create composer should render its persistent no-history shell.
 * Visible agent history is the only authority that dismisses the blank shell.
 */
export const resolveCreateComposerNoHistoryShell = ({
  hasVisibleAgentMessages,
}: ResolveCreateComposerNoHistoryShellParams): boolean => !hasVisibleAgentMessages;

/**
 * Suppresses helper copy that the Create shell intentionally does not surface inline.
 * The Generate CTA can remain disabled without reintroducing removed warning text.
 */
export const resolveCreateComposerInlineGuardrailReason = (
  guardrailReason: string | null | undefined
): string | null => {
  const normalizedReason = guardrailReason?.trim() ?? "";
  if (!normalizedReason) return null;
  if (BANNED_CREATE_INLINE_GUARDRAIL_COPY.has(normalizedReason)) return null;
  return normalizedReason;
};
