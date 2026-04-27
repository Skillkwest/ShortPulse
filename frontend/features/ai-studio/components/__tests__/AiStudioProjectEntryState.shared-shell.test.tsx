import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AiStudioProjectEntryState,
  type AiStudioProjectEntryStep,
} from "../AiStudioProjectEntryState";

describe("AiStudioProjectEntryState shared shell overrides", () => {
  it("renders caller-provided copy and step definitions", () => {
    const steps: AiStudioProjectEntryStep[] = [
      {
        id: "session",
        label: "Verify session",
        hint: "Confirm access before opening protected tools.",
      },
      {
        id: "compliance",
        label: "Check media agreement",
        hint: "Load the current acceptance requirement.",
      },
      {
        id: "studio",
        label: "Open studio",
        hint: "Continue into the workspace shell.",
      },
    ];

    render(
      <AiStudioProjectEntryState
        variant="loading"
        phase="resolving-project"
        title="Opening AI Studio"
        message="Checking your session before AI Studio opens."
        steps={steps}
        activeStepIndex={1}
        stepsAriaLabel="AI Studio access progress"
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Opening AI Studio");
    expect(screen.queryByText("AI Studio Access Check")).not.toBeInTheDocument();
    expect(screen.queryByText("Checking your session…")).not.toBeInTheDocument();
    expect(screen.getByLabelText("AI Studio access progress")).toBeInTheDocument();
    expect(screen.getByText("Verify session")).toBeInTheDocument();
    expect(screen.getByText("Check media agreement")).toBeInTheDocument();
    expect(screen.getByText("Open studio")).toBeInTheDocument();
  });
});
