import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiStudioProjectEntryState } from "../AiStudioProjectEntryState";

describe("AiStudioProjectEntryState", () => {
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

  it("renders the animated loading surface while preserving accessible progress copy", () => {
    const { container } = render(
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
    expect(container.querySelector(".ai-studio-project-entry-visual-stage")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-pulse-plane")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-pulse-motion")).not.toBeNull();
    expect(screen.getByTestId("entry-animation-stage")).toBeInTheDocument();
  });

  it("keeps the animated entry surface driven by the exact symbol-only PNG mask", () => {
    const { container } = render(
      <AiStudioProjectEntryState
        variant="loading"
        phase="loading-workspace"
        projectTitle="Spring Campaign"
      />
    );

    expect(container.querySelector(".ai-studio-project-entry-pulse-plane")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-pulse-bloom")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-pulse-sweep")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-artwork")).toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-pulse-runner")).toBeNull();
  });

  it("keeps the source PNG blocker asset aligned with the page background contract", () => {
    const bgPath = path.join(process.cwd(), "public/loading-entry/bg.png");
    const bgBuffer = fs.readFileSync(bgPath);

    expect(bgBuffer.length).toBeGreaterThan(0);
    expect(bgBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      true
    );
  });

  it("keeps the derived symbol-only mask asset available for the invisible cutout effect", () => {
    const maskPath = path.join(process.cwd(), "public/loading-entry/mask.png");
    const maskBuffer = fs.readFileSync(maskPath);

    expect(maskBuffer.length).toBeGreaterThan(0);
    expect(maskBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      true
    );
  });

  it("uses the animated entry surface as the canonical loading state", () => {
    const { container } = render(
      <AiStudioProjectEntryState
        variant="loading"
        phase="loading-workspace"
        projectTitle="Spring Campaign"
      />
    );

    expect(container.querySelector(".ai-studio-project-entry-visual-stage")).not.toBeNull();
    expect(container.querySelector(".ai-studio-project-entry-loader")).toBeNull();
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
