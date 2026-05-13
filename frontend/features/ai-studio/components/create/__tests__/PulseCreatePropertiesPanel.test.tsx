import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulseCreatePropertiesPanel } from "../PulseCreatePropertiesPanel";

vi.mock("../PulseCreatePanelView", () => ({
  PulseCreatePanelView: ({
    promptStepProps,
  }: {
    promptStepProps: { pulseLoadingState?: { message?: string | null } | null };
  }) => (
    <div data-testid="pulse-panel-view">
      <span data-testid="pulse-loading-message">
        {promptStepProps.pulseLoadingState?.message ?? ""}
      </span>
    </div>
  ),
}));

const baseProps: React.ComponentProps<typeof PulseCreatePropertiesPanel> = {
  pulsePrompt: "",
  onPulsePromptChange: vi.fn(),
  onGeneratePulseArtifact: vi.fn(),
  onSavePrompt: vi.fn(),
  agentEnabled: true,
  expertCreateUiEligible: true,
  activePulsePresetId: "pulse_custom",
  activePulsePresetLabel: "Custom Pulse",
  agentUiBusy: true,
  agentMessages: [],
};

describe("PulseCreatePropertiesPanel", () => {
  it("omits helper startup messaging for custom Pulses", () => {
    render(
      <PulseCreatePropertiesPanel
        {...baseProps}
        activePulsePresetKind="custom_gpt"
        pulseWorkflowSession={null}
      />
    );

    expect(screen.getByTestId("pulse-loading-message")).toBeEmptyDOMElement();
  });

  it("omits helper startup messaging for built-in workflows", () => {
    render(
      <PulseCreatePropertiesPanel
        {...baseProps}
        activePulsePresetId="story_builder"
        activePulsePresetLabel="DFY Story Builder"
        activePulsePresetKind="guided_workflow"
        pulseWorkflowSession={{
          presetId: "story_builder",
          status: "running",
          currentStepIndex: 1,
          currentStepLabel: "Upload Characters",
          currentStepPrompt: "Upload your characters.",
          collectedInputs: [],
          lastArtifact: null,
        }}
      />
    );

    expect(screen.getByTestId("pulse-loading-message")).toBeEmptyDOMElement();
  });

  it("treats an in-flight send as startup loading when the first pulse response has not landed yet", () => {
    render(
      <PulseCreatePropertiesPanel
        {...baseProps}
        agentUiBusy={false}
        agentTransportSending={false}
        agentIsSending
        activePulsePresetKind="custom_gpt"
        pulseWorkflowSession={null}
      />
    );

    expect(screen.getByTestId("pulse-loading-message")).toBeEmptyDOMElement();
  });
});
