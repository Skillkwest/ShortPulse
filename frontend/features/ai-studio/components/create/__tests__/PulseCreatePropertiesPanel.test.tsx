import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulseCreatePropertiesPanel } from "../PulseCreatePropertiesPanel";

vi.mock("../PulseCreatePanelView", () => ({
  PulseCreatePanelView: ({
    promptStepProps,
    onPulsePresetRestart,
  }: {
    promptStepProps: {
      pulseLoadingState?: { message?: string | null } | null;
      hideHeader?: boolean;
      chatHistoryHeaderContent?: React.ReactNode;
    };
    onPulsePresetRestart?: unknown;
  }) => (
    <div data-testid="pulse-panel-view">
      <span data-testid="pulse-loading-message">
        {promptStepProps.pulseLoadingState?.message ?? ""}
      </span>
      <span data-testid="pulse-hide-header">{String(Boolean(promptStepProps.hideHeader))}</span>
      <div data-testid="pulse-history-header">{promptStepProps.chatHistoryHeaderContent}</div>
      <span data-testid="pulse-restart-wired">{String(Boolean(onPulsePresetRestart))}</span>
    </div>
  ),
}));

const baseProps: React.ComponentProps<typeof PulseCreatePropertiesPanel> = {
  pulsePrompt: "",
  onPulsePromptChange: vi.fn(),
  onGeneratePulseArtifact: vi.fn(),
  agentEnabled: true,
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

  it("does not show the active Pulse banner while startup is still pending", () => {
    render(
      <PulseCreatePropertiesPanel
        {...baseProps}
        activePulsePresetId="story_builder"
        activePulsePresetLabel="DFY Story Builder"
        activePulsePresetKind="guided_workflow"
        hasActivePulseSession={false}
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

    expect(screen.queryByLabelText("Active Pulse")).not.toBeInTheDocument();
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
    expect(screen.getByTestId("pulse-hide-header")).toHaveTextContent("true");
    expect(screen.getByLabelText("Active Pulse")).toHaveTextContent("DFY Story Builder");
    expect(screen.getByText("Current Step: Upload Characters")).toBeInTheDocument();
    expect(screen.getByText("Upload your characters.")).toBeInTheDocument();
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

  it("wires an explicit restart action into the Pulse panel view", () => {
    render(
      <PulseCreatePropertiesPanel
        {...baseProps}
        activePulsePresetKind="custom_gpt"
        pulseWorkflowSession={null}
        onPulsePresetRestart={vi.fn()}
      />
    );

    expect(screen.getByTestId("pulse-restart-wired")).toHaveTextContent("true");
  });

  it("uses a concise completion summary instead of rendering the full final artifact in the banner", () => {
    render(
      <PulseCreatePropertiesPanel
        {...baseProps}
        activePulsePresetId="story_builder"
        activePulsePresetLabel="DFY Story Builder"
        activePulsePresetKind="guided_workflow"
        pulseWorkflowSession={{
          presetId: "story_builder",
          status: "completed",
          currentStepIndex: 6,
          currentStepLabel: "Final Output",
          currentStepPrompt: null,
          collectedInputs: ["hero", "city", "storm"],
          lastArtifact:
            "This is a very long final artifact that should stay out of the compact Active Pulse banner.",
          finalArtifactSource: "chat_reply",
        }}
      />
    );

    expect(screen.getByLabelText("Active Pulse")).toHaveTextContent("Final artifact completed.");
    expect(
      screen.queryByText(
        "This is a very long final artifact that should stay out of the compact Active Pulse banner."
      )
    ).not.toBeInTheDocument();
  });
});
