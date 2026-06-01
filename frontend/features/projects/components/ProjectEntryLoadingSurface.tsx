/**
 * Shared project-entry loading surface.
 * Renders the animated full-page bootstrap state used by dashboard and AI Studio
 * while protected project/workspace loading is still settling.
 */
import React from "react";
import styles from "../../../styles/project-entry-loading-surface.module.css";

export type ProjectEntryLoadingStep = {
  id: string;
  label: string;
  hint: string;
};

type ProjectEntryLoadingSurfaceProps = {
  title: string;
  message: string;
  steps: ProjectEntryLoadingStep[];
  activeStepIndex: number;
  stepsAriaLabel?: string;
};

type EntryStepState = "complete" | "active" | "pending";

const getStepState = (stepIndex: number, currentStepIndex: number): EntryStepState => {
  if (stepIndex < currentStepIndex) return "complete";
  if (stepIndex === currentStepIndex) return "active";
  return "pending";
};

/**
 * Renders the animated project-entry loading surface while preserving accessible progress copy.
 */
export function ProjectEntryLoadingSurface({
  title,
  message,
  steps,
  activeStepIndex,
  stepsAriaLabel,
}: ProjectEntryLoadingSurfaceProps) {
  const [isAnimatedMaskReady, setIsAnimatedMaskReady] = React.useState(false);

  React.useEffect(() => {
    const bgImage = new Image();
    bgImage.decoding = "async";
    bgImage.src = "/loading-entry/mask.png";

    if (bgImage.complete) {
      setIsAnimatedMaskReady(true);
      return;
    }

    const handleLoad = () => setIsAnimatedMaskReady(true);
    bgImage.addEventListener("load", handleLoad);

    return () => {
      bgImage.removeEventListener("load", handleLoad);
    };
  }, []);

  return (
    <main
      className={`page page-wide ai-studio-project-entry-page ai-studio-project-entry-page--animated ${styles.bootstrapStyleScope}`}
    >
      <section className="ai-studio-project-entry-visual-shell" aria-hidden="true">
        <div className="ai-studio-project-entry-visual-stage" data-testid="entry-animation-stage">
          <div
            className={`ai-studio-project-entry-pulse-plane${isAnimatedMaskReady ? " is-visible" : ""}`}
          >
            <div className="ai-studio-project-entry-pulse-motion">
              <div className="ai-studio-project-entry-pulse-bloom" />
              <div className="ai-studio-project-entry-pulse-sweep" />
            </div>
          </div>
        </div>
      </section>

      <section
        className="ai-studio-project-entry-visual-fallback-copy"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <h1 className="ai-studio-project-entry-title">{title}</h1>
        <p className="ai-studio-project-entry-message">{message}</p>
      </section>

      <ol className="sr-only" aria-label={stepsAriaLabel ?? "Project restore progress"}>
        {steps.map((step, index) => {
          const stepState = getStepState(index, activeStepIndex);
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
