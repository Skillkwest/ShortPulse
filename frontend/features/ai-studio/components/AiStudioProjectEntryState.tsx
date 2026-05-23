/**
 * AI Studio project entry state.
 * Renders the full-page loading and error experience shown while project identity and
 * project-backed workspace restore are still settling before the main studio shell mounts.
 */
import React from "react";

export type AiStudioProjectEntryPhase =
  | "resolving-project"
  | "loading-workspace"
  | "restoring-workspace"
  | "preparing-empty-workspace";

export type AiStudioProjectEntryStep = {
  id: string;
  label: string;
  hint: string;
};

type AiStudioProjectEntryStateProps = {
  variant: "loading" | "error";
  phase: AiStudioProjectEntryPhase;
  enableExperimentalAnimation?: boolean;
  projectTitle?: string | null;
  title?: string;
  message?: string;
  steps?: AiStudioProjectEntryStep[];
  activeStepIndex?: number;
  stepsAriaLabel?: string;
  errorTitle?: string;
  errorMessage?: string | null;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

type EntryStepState = "complete" | "active" | "pending";

const isExperimentalEntryAnimationEnabled = (requested: boolean): boolean =>
  requested && process.env.NEXT_PUBLIC_AI_STUDIO_ENTRY_ANIMATION_EXPERIMENT !== "false";

export const AI_STUDIO_PROJECT_OPEN_STEPS: AiStudioProjectEntryStep[] = [
  {
    id: "session",
    label: "Verify session",
    hint: "Confirm your authenticated workspace access.",
  },
  {
    id: "compliance",
    label: "Check media agreement",
    hint: "Load your one-time media compliance acceptance.",
  },
  {
    id: "resolve",
    label: "Resolve project",
    hint: "Confirm ownership and load the project identity.",
  },
  {
    id: "workspace",
    label: "Load workspace",
    hint: "Fetch the latest project-backed workspace snapshot.",
  },
  {
    id: "prepare",
    label: "Prepare studio",
    hint: "Apply the workspace and open AI Studio.",
  },
];

const getCurrentStepIndex = (phase: AiStudioProjectEntryPhase): number => {
  switch (phase) {
    case "resolving-project":
      return 2;
    case "loading-workspace":
      return 3;
    case "restoring-workspace":
    case "preparing-empty-workspace":
      return 4;
    default:
      return 2;
  }
};

const getStepState = (
  stepIndex: number,
  currentStepIndex: number,
  variant: "loading" | "error"
): EntryStepState => {
  if (stepIndex < currentStepIndex) return "complete";
  if (stepIndex === currentStepIndex) return "active";
  return variant === "error" ? "pending" : "pending";
};

const getTitle = ({
  variant,
  phase,
  projectTitle,
  errorTitle,
}: {
  variant: "loading" | "error";
  phase: AiStudioProjectEntryPhase;
  projectTitle?: string | null;
  errorTitle?: string;
}): string => {
  if (variant === "error") return errorTitle ?? "Project unavailable";
  if (projectTitle) return `Opening ${projectTitle}`;
  if (phase === "preparing-empty-workspace") return "Preparing project workspace";
  return "Loading project";
};

const getMessage = ({
  variant,
  phase,
  projectTitle,
  errorMessage,
}: {
  variant: "loading" | "error";
  phase: AiStudioProjectEntryPhase;
  projectTitle?: string | null;
  errorMessage?: string | null;
}): string => {
  if (variant === "error") return errorMessage?.trim() || "Failed to open project.";
  switch (phase) {
    case "resolving-project":
      return "Validating your saved project before AI Studio restore continues.";
    case "loading-workspace":
      return projectTitle
        ? `Loading the latest workspace snapshot for ${projectTitle}.`
        : "Loading the latest workspace snapshot for your project.";
    case "restoring-workspace":
      return "Saved workspace found. Applying it now and preparing the studio.";
    case "preparing-empty-workspace":
      return "No saved workspace was found. Starting with a fresh AI Studio workspace.";
    default:
      return "Preparing AI Studio.";
  }
};

/**
 * Renders the full-page AI Studio entry surface used during project bootstrap and failure states.
 */
export function AiStudioProjectEntryState({
  variant,
  phase,
  enableExperimentalAnimation = false,
  projectTitle = null,
  title,
  message,
  steps,
  activeStepIndex,
  stepsAriaLabel,
  errorTitle,
  errorMessage,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: AiStudioProjectEntryStateProps) {
  const resolvedTitle = title ?? getTitle({ variant, phase, projectTitle, errorTitle });
  const resolvedMessage = message ?? getMessage({ variant, phase, projectTitle, errorMessage });
  const resolvedSteps = steps ?? AI_STUDIO_PROJECT_OPEN_STEPS;
  const currentStepIndex = activeStepIndex ?? getCurrentStepIndex(phase);
  const liveRole = variant === "error" ? "alert" : "status";
  const liveMode = variant === "error" ? "assertive" : "polite";
  const shouldUseExperimentalAnimation =
    variant === "loading" && isExperimentalEntryAnimationEnabled(enableExperimentalAnimation);

  if (shouldUseExperimentalAnimation) {
    return (
      <main className="page page-wide ai-studio-project-entry-page ai-studio-project-entry-page--experimental">
        <section className="ai-studio-project-entry-visual-shell" aria-hidden="true">
          <div className="ai-studio-project-entry-visual-stage" data-testid="entry-animation-stage">
            <div className="ai-studio-project-entry-pulse-plane">
              <div className="ai-studio-project-entry-pulse-mask">
                <div className="ai-studio-project-entry-pulse-motion">
                  <div className="ai-studio-project-entry-pulse-bloom" />
                  <div className="ai-studio-project-entry-pulse-sweep" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="ai-studio-project-entry-visual-fallback-copy"
          role={liveRole}
          aria-live={liveMode}
          aria-atomic="true"
        >
          <h1 className="ai-studio-project-entry-title">{resolvedTitle}</h1>
          <p className="ai-studio-project-entry-message">{resolvedMessage}</p>
        </section>

        <ol className="sr-only" aria-label={stepsAriaLabel ?? "Project restore progress"}>
          {resolvedSteps.map((step, index) => {
            const stepState = getStepState(index, currentStepIndex, variant);
            return (
              <li key={step.id} data-step-state={stepState}>
                <span>{step.label}</span>
                <span>{step.hint}</span>
              </li>
            );
          })}
        </ol>
      </main>
    );
  }

  return (
    <main className="page page-wide ai-studio-project-entry-page">
      <section className="panel ai-studio-project-entry-card">
        <div className="ai-studio-project-entry-orb" aria-hidden="true" />
        <div
          className="ai-studio-project-entry-copy"
          role={liveRole}
          aria-live={liveMode}
          aria-atomic="true"
        >
          <h1 className="ai-studio-project-entry-title">{resolvedTitle}</h1>
          <p className="ai-studio-project-entry-message">{resolvedMessage}</p>
        </div>

        <div className="ai-studio-project-entry-body">
          {variant === "loading" ? (
            <div className={`ai-studio-project-entry-loader is-${variant}`} aria-hidden="true">
              <div className="reference-spinner ai-studio-project-entry-spinner" />
              <div className="ai-studio-project-entry-loader-bar" />
            </div>
          ) : null}

          <ol
            className="ai-studio-project-entry-steps"
            aria-label={stepsAriaLabel ?? "Project restore progress"}
          >
            {resolvedSteps.map((step, index) => {
              const stepState = getStepState(index, currentStepIndex, variant);
              return (
                <li
                  key={step.id}
                  className={`ai-studio-project-entry-step is-${stepState}`}
                  data-step-state={stepState}
                >
                  <span className="ai-studio-project-entry-step-marker" aria-hidden="true" />
                  <div className="ai-studio-project-entry-step-copy">
                    <span className="ai-studio-project-entry-step-label">{step.label}</span>
                    <span className="ai-studio-project-entry-step-hint">{step.hint}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {primaryActionLabel && onPrimaryAction ? (
          <div className="ai-studio-project-entry-actions">
            <button type="button" className="primary-btn small" onClick={onPrimaryAction}>
              {primaryActionLabel}
            </button>
            {secondaryActionLabel && onSecondaryAction ? (
              <button type="button" className="ghost-btn small" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
