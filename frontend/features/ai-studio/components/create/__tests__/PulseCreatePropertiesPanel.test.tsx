import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulseCreatePropertiesPanel } from "../PulseCreatePropertiesPanel";

vi.mock("../PulseCreatePanelView", () => ({
  PulseCreatePanelView: ({
    promptStepProps,
    isPulseActivationBusy,
  }: {
    promptStepProps: {
      pulseLoadingState?: { message?: string | null } | null;
      hideHeader?: boolean;
      agentInputDisabled?: boolean;
      agentInputCollapseOnBlur?: boolean;
      agentInputVerticalExpansionAnchor?: "top" | "bottom";
      chatHistoryHeaderContent?: React.ReactNode;
      composerLeadingContent?: React.ReactNode;
      composerMiddleContent?: React.ReactNode;
    };
    isPulseActivationBusy?: boolean;
  }) => (
    <div data-testid="pulse-panel-view">
      <span data-testid="pulse-loading-message">
        {promptStepProps.pulseLoadingState?.message ?? ""}
      </span>
      <span data-testid="pulse-activation-busy">{String(Boolean(isPulseActivationBusy))}</span>
      <span data-testid="pulse-hide-header">{String(Boolean(promptStepProps.hideHeader))}</span>
      <span data-testid="pulse-agent-input-disabled">
        {String(Boolean(promptStepProps.agentInputDisabled))}
      </span>
      <span data-testid="pulse-agent-input-collapse-on-blur">
        {String(Boolean(promptStepProps.agentInputCollapseOnBlur))}
      </span>
      <span data-testid="pulse-agent-input-expansion-anchor">
        {promptStepProps.agentInputVerticalExpansionAnchor ?? ""}
      </span>
      <div data-testid="pulse-history-header">{promptStepProps.chatHistoryHeaderContent}</div>
      <div data-testid="pulse-leading-content">{promptStepProps.composerLeadingContent}</div>
      <div data-testid="pulse-middle-content">{promptStepProps.composerMiddleContent}</div>
    </div>
  ),
}));

const baseProps: React.ComponentProps<typeof PulseCreatePropertiesPanel> = {
  pulsePrompt: "",
  onPulsePromptChange: vi.fn(),
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
    expect(screen.getByTestId("pulse-history-header")).toBeEmptyDOMElement();
  });

  it("keeps the Pulse history header empty for built-in workflows", () => {
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
    expect(screen.queryByLabelText("Active Pulse")).not.toBeInTheDocument();
    expect(screen.getByTestId("pulse-history-header")).toBeEmptyDOMElement();
  });

  it("omits helper step messaging while built-in workflows generate the next turn", () => {
    render(
      <PulseCreatePropertiesPanel
        {...baseProps}
        activePulsePresetId="story_builder"
        activePulsePresetLabel="DFY Story Builder"
        activePulsePresetKind="guided_workflow"
        agentUiBusy={false}
        agentIsSending
        agentMessages={[{ id: "assistant-1", role: "assistant", content: "Upload your image." }]}
        pulseWorkflowSession={{
          presetId: "story_builder",
          status: "running",
          currentStepIndex: 2,
          currentStepLabel: "Image Gate",
          currentStepPrompt: "Upload your image.",
          collectedInputs: ["hero"],
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

  it("locks Pulse activation while UI-side startup work is busy", () => {
    render(
      <PulseCreatePropertiesPanel
        {...baseProps}
        agentUiBusy
        agentTransportSending={false}
        agentIsSending={false}
      />
    );

    expect(screen.getByTestId("pulse-activation-busy")).toHaveTextContent("true");
  });

  it("does not inject footer generate chrome into the Pulse composer", () => {
    render(<PulseCreatePropertiesPanel {...baseProps} isPromptGenerating />);

    expect(screen.getByTestId("pulse-leading-content")).toBeEmptyDOMElement();
    expect(screen.getByTestId("pulse-middle-content")).toBeEmptyDOMElement();
  });

  it("keeps long Pulse drafts expanded after blur", () => {
    render(<PulseCreatePropertiesPanel {...baseProps} />);

    expect(screen.getByTestId("pulse-agent-input-collapse-on-blur")).toHaveTextContent("false");
  });

  it("uses bottom-anchored expansion after a Pulse session starts", () => {
    render(<PulseCreatePropertiesPanel {...baseProps} hasActivePulseSession />);

    expect(screen.getByTestId("pulse-agent-input-disabled")).toHaveTextContent("false");
    expect(screen.getByTestId("pulse-agent-input-expansion-anchor")).toHaveTextContent("bottom");
  });

  it("disables composer input before a Pulse session is active", () => {
    render(
      <PulseCreatePropertiesPanel
        {...baseProps}
        activePulsePresetId={null}
        hasActivePulseSession={false}
        agentUiBusy={false}
      />
    );

    expect(screen.getByTestId("pulse-agent-input-disabled")).toHaveTextContent("true");
    expect(screen.getByTestId("pulse-agent-input-expansion-anchor")).toHaveTextContent("top");
  });

  it("keeps the Pulse history header empty after workflow completion", () => {
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

    expect(screen.queryByLabelText("Active Pulse")).not.toBeInTheDocument();
    expect(screen.getByTestId("pulse-history-header")).toBeEmptyDOMElement();
  });
});
