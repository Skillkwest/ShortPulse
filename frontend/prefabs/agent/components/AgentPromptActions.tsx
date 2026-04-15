/**
 * Shared primary-prompt status and action chips for agent-driven prompt workflows.
 * Used by inline prompt cards and the expanded agent chat column.
 */
import React from "react";
import type { AgentActions } from "../types";

type AgentPromptActionsProps = {
  primaryPrompt?: string | null;
  primarySource?: "agent" | "manual" | "reference";
  showPrimaryPromptStatus?: boolean;
  actions?: AgentActions;
};

/**
 * Renders prompt ownership status plus normalized agent action chips.
 */
export const AgentPromptActions: React.FC<AgentPromptActionsProps> = ({
  primaryPrompt,
  primarySource = "manual",
  showPrimaryPromptStatus = true,
}) => {
  const resolvedPrimaryPrompt = (primaryPrompt ?? "").trim();
  const hasPrimaryPrompt = resolvedPrimaryPrompt.length > 0;

  if (!showPrimaryPromptStatus) {
    return null;
  }

  return (
    <>
      {showPrimaryPromptStatus ? (
        <div className={`agent-primary-prompt${hasPrimaryPrompt ? "" : " is-empty"}`}>
          <p className="sr-only" role="status" aria-live="polite">
            {primarySource === "agent"
              ? "Primary generation prompt source is agent output."
              : primarySource === "reference"
                ? "Primary generation prompt source is reference prompt."
                : "Primary generation prompt source is manual prompt."}
          </p>
          <div className="agent-primary-prompt-head">
            <p className="tiny">Primary generation prompt</p>
            <span className={`agent-primary-source agent-primary-source--${primarySource}`}>
              {primarySource === "agent"
                ? "Agent output"
                : primarySource === "reference"
                  ? "Reference prompt"
                  : "Manual prompt"}
            </span>
          </div>
          <p className="tiny agent-primary-prompt-body">
            {hasPrimaryPrompt
              ? resolvedPrimaryPrompt
              : "Send a message to build the prompt Generate will use."}
          </p>
        </div>
      ) : null}
    </>
  );
};
