/**
 * AI Studio project entry state.
 * Renders the full-page loading and error experience shown while project identity and
 * project-backed workspace restore are still settling before the main studio shell mounts.
 */
import {
  ProjectEntryLoadingSurface,
  type ProjectEntryLoadingStep,
} from "../../projects/components/ProjectEntryLoadingSurface";

export type AiStudioProjectEntryPhase =
  | "resolving-project"
  | "loading-workspace"
  | "restoring-workspace"
  | "preparing-empty-workspace";

export type AiStudioProjectEntryStep = ProjectEntryLoadingStep;

type AiStudioProjectEntryStateProps = {
  variant: "loading" | "error";
  phase: AiStudioProjectEntryPhase;
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

  return (
    <ProjectEntryLoadingSurface
      title={resolvedTitle}
      message={resolvedMessage}
      steps={resolvedSteps}
      activeStepIndex={currentStepIndex}
      stepsAriaLabel={stepsAriaLabel}
      variant={variant}
      primaryActionLabel={primaryActionLabel}
      onPrimaryAction={onPrimaryAction}
      secondaryActionLabel={secondaryActionLabel}
      onSecondaryAction={onSecondaryAction}
    />
  );
}
