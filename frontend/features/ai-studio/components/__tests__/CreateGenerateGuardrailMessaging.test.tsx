import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulseCreatePanelView } from "../create/PulseCreatePanelView";
import { StandardCreatePanelView } from "../create/StandardCreatePanelView";
import type { PromptStepProps } from "../PromptStep";
import { CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS } from "../../../../lib/model-runtime/createPulsePresetDomain";

vi.mock("../../../../prefabs/agent", () => ({
  AgentResponseInlineGenerateButton: ({
    onClick,
    disabled,
    ariaLabel,
    className,
  }: {
    onClick?: () => void;
    disabled?: boolean;
    ariaLabel?: string;
    className?: string;
  }) => (
    <button
      type="button"
      className={`agent-response-inline-generate-prefab ${className ?? ""}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? "Generate"}
    >
      Generate
    </button>
  ),
}));

vi.mock("../PromptStep", () => ({
  PromptStep: ({
    composerLeadingContent,
    onAgentInputVisualRowCountChange,
    agentInput,
  }: {
    composerLeadingContent?: React.ReactNode;
    onAgentInputVisualRowCountChange?: (rowCount: number) => void;
    agentInput?: string;
  }) => {
    React.useEffect(() => {
      if (!onAgentInputVisualRowCountChange) return;
      onAgentInputVisualRowCountChange(agentInput ? 2 : 1);
    }, [agentInput, onAgentInputVisualRowCountChange]);

    return <div data-testid="prompt-step">{composerLeadingContent}</div>;
  },
}));

describe("Create generate guardrail messaging", () => {
  const message = "Select a model before generating.";
  const pulsePreferenceRuntime = {
    presetPanelIds: ["story_builder"],
    savedPresets: [],
    deletedBuiltInPresetIds: [],
    builtInDefinitions: CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
    builtInDefinitionsLoading: false,
    builtInDefinitionsAuthoritative: true,
    refreshBuiltInDefinitions: vi.fn(async () => CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS),
    setPresetPanelIds: vi.fn(async () => true),
    setSavedPresets: vi.fn(async () => true),
    restoreDeletedBuiltInPresetIds: vi.fn(async () => true),
  };

  it("does not show the removed detached expert generate warning", () => {
    render(
      <StandardCreatePanelView
        promptStepProps={{} as PromptStepProps}
        characterModeEnabled={false}
        onCharacterModeEnabledToggle={vi.fn()}
        onCharacterPickerOpen={vi.fn()}
        characterSelectDisabled={false}
        isCharacterSelectionEmpty
        selectedCharacterName="No Characters"
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
        showCreateControlSet
        shouldShowImageResolutionCard={false}
        imageResolutionValue="default"
        imageResolutionOptions={[]}
      />
    );

    expect(screen.queryByText(message)).not.toBeInTheDocument();
    expect(screen.queryByTestId("prompt-step")).toBeInTheDocument();
  });

  it("keeps the Standard empty-state shell visible while the composer only has a draft", () => {
    render(
      <StandardCreatePanelView
        promptStepProps={
          {
            agentInput: "A detailed cinematic prompt draft",
          } as PromptStepProps
        }
        characterModeEnabled={false}
        onCharacterModeEnabledToggle={vi.fn()}
        onCharacterPickerOpen={vi.fn()}
        characterSelectDisabled={false}
        isCharacterSelectionEmpty
        selectedCharacterName="No Characters"
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
        showCreateControlSet
        shouldShowImageResolutionCard={false}
        imageResolutionValue="default"
        imageResolutionOptions={[]}
      />
    );

    expect(screen.getByText("What do you want to make?")).toBeInTheDocument();
    expect(screen.queryByText("Send your next instruction.")).not.toBeInTheDocument();
  });

  it("shows the Standard blank empty-state shell when no visible history exists", () => {
    render(
      <StandardCreatePanelView
        promptStepProps={{} as PromptStepProps}
        characterModeEnabled={false}
        onCharacterModeEnabledToggle={vi.fn()}
        onCharacterPickerOpen={vi.fn()}
        characterSelectDisabled={false}
        isCharacterSelectionEmpty
        selectedCharacterName="No Characters"
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
        showCreateControlSet
        shouldShowImageResolutionCard={false}
        imageResolutionValue="default"
        imageResolutionOptions={[]}
      />
    );

    expect(screen.getByText("What do you want to make?")).toBeInTheDocument();
    expect(screen.queryByText("Send your next instruction.")).not.toBeInTheDocument();
  });

  it("does not show the removed empty-prompt helper copy in the Standard blank shell even if it is passed back in", () => {
    render(
      <StandardCreatePanelView
        promptStepProps={{} as PromptStepProps}
        characterModeEnabled={false}
        onCharacterModeEnabledToggle={vi.fn()}
        onCharacterPickerOpen={vi.fn()}
        characterSelectDisabled={false}
        isCharacterSelectionEmpty
        selectedCharacterName="No Characters"
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
        showCreateControlSet
        shouldShowImageResolutionCard={false}
        imageResolutionValue="default"
        imageResolutionOptions={[]}
        guardrailReason="Enter a prompt to generate."
      />
    );

    expect(screen.queryByText("Enter a prompt to generate.")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not show the removed describe-image helper copy in the Standard blank shell", () => {
    render(
      <StandardCreatePanelView
        promptStepProps={{} as PromptStepProps}
        characterModeEnabled={false}
        onCharacterModeEnabledToggle={vi.fn()}
        onCharacterPickerOpen={vi.fn()}
        characterSelectDisabled={false}
        isCharacterSelectionEmpty
        selectedCharacterName="No Characters"
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
        showCreateControlSet
        shouldShowImageResolutionCard={false}
        imageResolutionValue="default"
        imageResolutionOptions={[]}
        guardrailReason="Add or select an image to describe."
      />
    );

    expect(screen.queryByText("Add or select an image to describe.")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hides the Standard create control row when chat mode-only UI is requested", () => {
    render(
      <StandardCreatePanelView
        promptStepProps={{} as PromptStepProps}
        characterModeEnabled={false}
        onCharacterModeEnabledToggle={vi.fn()}
        onCharacterPickerOpen={vi.fn()}
        characterSelectDisabled={false}
        isCharacterSelectionEmpty
        selectedCharacterName="No Characters"
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
        showCreateControlSet={false}
        shouldShowImageResolutionCard
        imageResolutionValue="default"
        imageResolutionOptions={[]}
      />
    );

    expect(screen.queryByText("Character")).toBeNull();
    expect(screen.queryByText("Model")).toBeNull();
    expect(screen.queryByText("Aspect")).toBeNull();
    expect(screen.queryByText("Resolution")).toBeNull();
  });

  it("does not show the removed active Pulse status UI in Pulse mode", () => {
    render(
      <PulseCreatePanelView
        promptStepProps={{} as PromptStepProps}
        isPromptGenerating={false}
        activePulsePresetId="story_builder"
      />
    );

    expect(screen.queryByLabelText("Active Pulse")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Pulse activation hint")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
  });

  it("shows the Pulse blank empty-state shell when no visible history exists", () => {
    render(
      <PulseCreatePanelView
        promptStepProps={{} as unknown as PromptStepProps}
        isPromptGenerating={false}
        activePulsePresetId="story_builder"
        pulsePreferenceRuntime={pulsePreferenceRuntime}
      />
    );

    expect(screen.getByText("Choose a Pulse to start")).toBeInTheDocument();
    expect(screen.queryByText("Send your next instruction.")).not.toBeInTheDocument();
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
              presetLabel: "Multi Sequence Video Prompt",
            },
          } as unknown as PromptStepProps
        }
        isPromptGenerating={false}
        activePulsePresetId="multi_shot"
        pulsePreferenceRuntime={pulsePreferenceRuntime}
      />
    );

    const startupStatus = screen.getByRole("status", {
      name: "Starting Multi Sequence Video Prompt",
    });
    expect(screen.getByText("Starting Pulse")).toBeInTheDocument();
    expect(screen.getByText("Getting the first response ready.")).toBeInTheDocument();
    expect(screen.queryByText("Preparing your guided workflow...")).not.toBeInTheDocument();
    expect(screen.queryByText(/Next up:/)).not.toBeInTheDocument();
    expect(within(startupStatus).getByText(/Multi Sequence Video Prompt/)).toBeInTheDocument();
    expect(screen.queryByText("Choose a Pulse to start")).not.toBeInTheDocument();
  });

  it("shows the deactivate action for an active Pulse session without a restart control", () => {
    render(
      <PulseCreatePanelView
        promptStepProps={
          {
            onClearAgentChat: vi.fn(),
          } as unknown as PromptStepProps
        }
        onPulsePresetRestart={vi.fn()}
        isPromptGenerating={false}
        activePulsePresetId="story_builder"
        hasActivePulseSession
        pulsePreferenceRuntime={pulsePreferenceRuntime}
      />
    );

    expect(screen.queryByRole("button", { name: "Restart pulse" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deactivate pulse" })).toBeInTheDocument();
  });

  it("keeps the Pulse empty-state shell visible while the composer only has a draft", () => {
    render(
      <PulseCreatePanelView
        promptStepProps={
          {
            agentInput: "A guided Pulse draft",
          } as unknown as PromptStepProps
        }
        isPromptGenerating={false}
        activePulsePresetId="story_builder"
        pulsePreferenceRuntime={pulsePreferenceRuntime}
      />
    );

    expect(screen.getByText("Choose a Pulse to start")).toBeInTheDocument();
    expect(screen.queryByText("Send your next instruction.")).not.toBeInTheDocument();
  });

  it("locks deactivate while a Pulse artifact is generating", () => {
    render(
      <PulseCreatePanelView
        promptStepProps={
          {
            onClearAgentChat: vi.fn(),
          } as unknown as PromptStepProps
        }
        onPulsePresetRestart={vi.fn()}
        isPromptGenerating
        activePulsePresetId="story_builder"
        hasActivePulseSession
        pulsePreferenceRuntime={pulsePreferenceRuntime}
      />
    );

    expect(screen.getByRole("button", { name: "Deactivate pulse" })).toBeDisabled();
  });
});
