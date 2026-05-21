import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiStudioProjectEntryState } from "../AiStudioProjectEntryState";

describe("AiStudioProjectEntryState", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the project restore loading state with resolved project context", () => {
    render(
      <AiStudioProjectEntryState
        variant="loading"
        phase="loading-workspace"
        projectTitle="Spring Campaign"
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Opening Spring Campaign");
    expect(
      screen.getByText("Loading the latest workspace snapshot for Spring Campaign.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Project restore progress")).toBeInTheDocument();
    expect(screen.getByText("Verify session")).toBeInTheDocument();
    expect(screen.getByText("Check media agreement")).toBeInTheDocument();
    expect(screen.getByText("Resolve project")).toBeInTheDocument();
    expect(screen.getByText("Load workspace")).toBeInTheDocument();
    expect(screen.getByText("Prepare studio")).toBeInTheDocument();
    expect(screen.queryByText("Workspace snapshot loading")).not.toBeInTheDocument();
  });

  it("renders the experimental loading animation while preserving accessible progress copy", () => {
    vi.stubEnv("NEXT_PUBLIC_AI_STUDIO_ENTRY_ANIMATION_EXPERIMENT", "true");

    const { container } = render(
      <AiStudioProjectEntryState
        variant="loading"
        phase="loading-workspace"
        enableExperimentalAnimation
        projectTitle="Spring Campaign"
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Opening Spring Campaign");
    expect(
      screen.getByText("Loading the latest workspace snapshot for Spring Campaign.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Project restore progress")).toBeInTheDocument();
    expect(container.querySelector(".ai-studio-project-entry-visual-stage")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-pulse-plane")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-mask-blocker")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-pulse-motion")).not.toBeNull();
    expect(screen.getByTestId("entry-animation-stage")).toBeInTheDocument();
  });

  it("renders the masked sweep without the old image-based layers", () => {
    vi.stubEnv("NEXT_PUBLIC_AI_STUDIO_ENTRY_ANIMATION_EXPERIMENT", "true");

    const { container } = render(
      <AiStudioProjectEntryState
        variant="loading"
        phase="loading-workspace"
        enableExperimentalAnimation
        projectTitle="Spring Campaign"
      />
    );

    expect(container.querySelector(".ai-studio-project-entry-pulse-plane")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-mask-blocker")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-pulse-bloom")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-pulse-sweep")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-pulse-runner")).toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-bg-image")).toBeNull();
  });

  it("keeps the PNG blocker asset aligned with the page background contract", () => {
    const bgPath = path.join(process.cwd(), "public/loading-entry/bg.png");
    const bgBuffer = fs.readFileSync(bgPath);

    expect(bgBuffer.length).toBeGreaterThan(0);
    expect(bgBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      true
    );
  });

  it("keeps the legacy loader when the experimental flag is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_AI_STUDIO_ENTRY_ANIMATION_EXPERIMENT", "false");

    const { container } = render(
      <AiStudioProjectEntryState
        variant="loading"
        phase="loading-workspace"
        enableExperimentalAnimation
        projectTitle="Spring Campaign"
      />
    );

    expect(container.querySelector(".ai-studio-project-entry-loader")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-visual-stage")).toBeNull();
    expect(screen.getByText("Verify session")).toBeInTheDocument();
  });

  it("renders the error state actions and forwards button events", () => {
    const handleRetry = vi.fn();
    const handleBack = vi.fn();

    const { container } = render(
      <AiStudioProjectEntryState
        variant="error"
        phase="loading-workspace"
        projectTitle="Spring Campaign"
        errorTitle="Project workspace unavailable"
        errorMessage="Failed to load project workspace."
        primaryActionLabel="Retry workspace load"
        onPrimaryAction={handleRetry}
        secondaryActionLabel="Back to dashboard"
        onSecondaryAction={handleBack}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Project workspace unavailable");
    expect(screen.getByText("Failed to load project workspace.")).toBeInTheDocument();
    expect(container.querySelector(".ai-studio-project-entry-loader")).toBeNull();
    expect(container.querySelector(".reference-spinner")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry workspace load" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));

    expect(handleRetry).toHaveBeenCalledTimes(1);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it("surfaces the fresh-workspace message when no snapshot exists", () => {
    render(<AiStudioProjectEntryState variant="loading" phase="preparing-empty-workspace" />);

    expect(screen.getByRole("status")).toHaveTextContent("Preparing project workspace");
    expect(
      screen.getByText("No saved workspace was found. Starting with a fresh AI Studio workspace.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Fresh workspace")).not.toBeInTheDocument();
  });
});
