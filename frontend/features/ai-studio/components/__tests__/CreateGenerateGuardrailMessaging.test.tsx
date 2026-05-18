import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulseCreatePanelView } from "../create/PulseCreatePanelView";
import { StandardCreatePanelView } from "../create/StandardCreatePanelView";
import type { PromptStepProps } from "../PromptStep";

vi.mock("../../../../prefabs/agent", () => ({
  AgentGenerateButton: ({
    onClick,
    disabled,
    ariaLabel,
  }: {
    onClick?: () => void;
    disabled?: boolean;
    ariaLabel?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? "Generate"}
    >
      Generate
    </button>
  ),
}));

vi.mock("../PromptStep", () => ({
  PromptStep: ({ composerLeadingContent }: { composerLeadingContent?: React.ReactNode }) => (
    <div data-testid="prompt-step">{composerLeadingContent}</div>
  ),
}));

describe("Create generate guardrail messaging", () => {
  const message = "Select a model before generating.";

  it("does not show the removed detached expert generate warning", () => {
    render(
      <StandardCreatePanelView
        promptStepProps={{} as PromptStepProps}
        onGenerate={vi.fn()}
        costCredits={15}
        isPromptGenerating={false}
        isGenerateDisabled
        guardrailReason={message}
        characterModeEnabled={false}
        onCharacterModeEnabledToggle={vi.fn()}
        onCharacterPickerOpen={vi.fn()}
        characterSelectDisabled={false}
        isCharacterSelectionEmpty
        selectedCharacterName="No characters available"
        selectedCharacterProfileImageUrl={null}
        selectedCharacterInitials={null}
        isCharacterPickerOpen={false}
        isCreateModelPickerOpen={false}
        isModelSelectionEmpty={false}
        onCreateModelOpen={vi.fn()}
        useUnoptimizedModelLogo={false}
        effectiveModelLabel="Seedream 4.5 Edit"
        aspect="9:16"
        aspectOptionsForModel={[]}
        onAspectChange={vi.fn()}
        shouldShowImageResolutionCard={false}
        imageResolutionValue="default"
        imageResolutionOptions={[]}
      />
    );

    expect(screen.queryByText(message)).not.toBeInTheDocument();
    expect(screen.queryByTestId("prompt-step")).toBeInTheDocument();
  });

  it("does not show the removed active Pulse status UI in Pulse mode", () => {
    render(
      <PulseCreatePanelView
        promptStepProps={{} as PromptStepProps}
        onGeneratePulseArtifact={vi.fn()}
        costCredits={15}
        isPromptGenerating={false}
        isGenerateDisabled={false}
        activePulsePresetId="story_builder"
      />
    );

    expect(screen.queryByLabelText("Active Pulse")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Pulse activation hint")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
  });

  it("shows an obvious centered startup state while a Pulse is loading its first response", () => {
    render(
      <PulseCreatePanelView
        promptStepProps={
          {
            agentMessages: [],
            pulseLoadingState: {
              phase: "starting_pulse",
              title: "Generating...",
              message: "Preparing your guided workflow...",
              presetLabel: "Multi Sequence Video Prompt",
              stepLabel: "Upload Image",
            },
          } as unknown as PromptStepProps
        }
        onGeneratePulseArtifact={vi.fn()}
        costCredits={15}
        isPromptGenerating={false}
        isGenerateDisabled={false}
        activePulsePresetId="multi_shot"
      />
    );

    const startupStatus = screen.getByRole("status", {
      name: "Starting Multi Sequence Video Prompt",
    });
    expect(screen.getByText("Starting Pulse")).toBeInTheDocument();
    expect(screen.getByText("Preparing your guided workflow...")).toBeInTheDocument();
    expect(within(startupStatus).getByText(/Multi Sequence Video Prompt/)).toBeInTheDocument();
    expect(screen.queryByText("What do you want to make?")).not.toBeInTheDocument();
  });
});
