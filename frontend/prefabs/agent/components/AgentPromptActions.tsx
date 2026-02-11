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
  onApplyPrompt?: (prompt: string) => void;
  onSelectVariation?: (prompt: string) => void;
  onUseQuestion?: (question: string) => void;
  onDescribeTargets?: (targets: string[]) => void;
};

/**
 * Renders prompt ownership status plus normalized agent action chips.
 */
export const AgentPromptActions: React.FC<AgentPromptActionsProps> = ({
  primaryPrompt,
  primarySource = "manual",
  showPrimaryPromptStatus = true,
  actions,
  onSelectVariation,
  onUseQuestion,
  onDescribeTargets,
}) => {
  const resolvedPrimaryPrompt = (primaryPrompt ?? "").trim();
  const hasPrimaryPrompt = resolvedPrimaryPrompt.length > 0;
  const variations =
    actions?.variations?.map((variation) => variation.trim()).filter(Boolean) ?? [];
  const questions = actions?.questions?.map((question) => question.trim()).filter(Boolean) ?? [];
  const describeTargets = actions?.describeTargets?.filter(Boolean) ?? [];
  const hasAgentActions =
    variations.length > 0 || questions.length > 0 || describeTargets.length > 0;

  if (!showPrimaryPromptStatus && !hasAgentActions) {
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
      {hasAgentActions ? (
        <div className="agent-action-strip" aria-label="Agent actions">
          {describeTargets.length ? (
            <button
              type="button"
              className="ghost-btn mini agent-action-btn"
              onClick={() => onDescribeTargets?.(describeTargets)}
            >
              Describe refs ({describeTargets.length})
            </button>
          ) : null}
          {variations.slice(0, 3).map((variation) => (
            <button
              key={variation}
              type="button"
              className="ghost-btn mini agent-action-chip"
              onClick={() => onSelectVariation?.(variation)}
              title={variation}
            >
              {variation}
            </button>
          ))}
          {questions.slice(0, 2).map((question) => (
            <button
              key={question}
              type="button"
              className="ghost-btn mini agent-action-chip agent-action-chip--question"
              onClick={() => onUseQuestion?.(question)}
              title={question}
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
};
