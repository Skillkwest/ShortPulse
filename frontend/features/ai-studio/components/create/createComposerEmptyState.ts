/**
 * Shared Create composer empty-state helpers.
 * Keeps the Standard and Pulse blank-shell ownership rule aligned.
 */

type ResolveCreateComposerNoHistoryShellParams = {
  hasVisibleAgentMessages: boolean;
};

/**
 * Returns whether the Create composer should render its persistent no-history shell.
 * Visible agent history is the only authority that dismisses the blank shell.
 */
export const resolveCreateComposerNoHistoryShell = ({
  hasVisibleAgentMessages,
}: ResolveCreateComposerNoHistoryShellParams): boolean => !hasVisibleAgentMessages;
