import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComposeSendCard } from "../create/StandardCreatePropertiesPanel";
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
  PromptStep: () => <div data-testid="prompt-step" />,
}));

describe("Create generate guardrail messaging", () => {
  const message = "Select a model before generating.";

  it("shows the guardrail reason directly under the disabled compose generate button", () => {
    render(
      <ComposeSendCard
        onGenerate={vi.fn()}
        costCredits={15}
        isGenerateDisabled
        isPromptGenerating={false}
        guardrailReason={message}
      />
    );

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("shows the guardrail reason next to the expert inline generate button", () => {
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

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("does not show the removed active Pulse status UI in Pulse mode", () => {
    render(
      <PulseCreatePanelView
        promptStepProps={{} as PromptStepProps}
        onGenerate={vi.fn()}
        costCredits={15}
        isPromptGenerating={false}
        isGenerateDisabled={false}
        expertCreateMode="pulse"
        activePulsePresetId="story_builder"
      />
    );

    expect(screen.queryByLabelText("Active Pulse")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Pulse activation hint")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
  });
});
