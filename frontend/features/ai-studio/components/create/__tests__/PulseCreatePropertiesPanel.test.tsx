import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulseCreatePropertiesPanel } from "../PulseCreatePropertiesPanel";

vi.mock("../PulseCreatePanelView", () => ({
  PulseCreatePanelView: ({
    promptStepProps,
  }: {
    promptStepProps: {
      pulseLoadingState?: { message?: string | null } | null;
      hideHeader?: boolean;
      chatHistoryHeaderContent?: React.ReactNode;
      composerLeadingContent?: React.ReactNode;
      composerMiddleContent?: React.ReactNode;
    };
  }) => (
    <div data-testid="pulse-panel-view">
      <span data-testid="pulse-loading-message">
        {promptStepProps.pulseLoadingState?.message ?? ""}
      </span>
      <span data-testid="pulse-hide-header">{String(Boolean(promptStepProps.hideHeader))}</span>
      <div data-testid="pulse-history-header">{promptStepProps.chatHistoryHeaderContent}</div>
      <div data-testid="pulse-leading-content">{promptStepProps.composerLeadingContent}</div>
      <div data-testid="pulse-middle-content">{promptStepProps.composerMiddleContent}</div>
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

  it("mounts Pulse generate in composer-leading content and keeps guardrail copy separate", () => {
    render(
      <PulseCreatePropertiesPanel
        {...baseProps}
        costCredits={4}
        isPromptGenerating
        isGenerateDisabled
        guardrailReason="Complete the active Pulse before generating."
      />
    );

    expect(
      within(screen.getByTestId("pulse-leading-content")).getByRole("button", {
        name: "Generate",
      })
    ).toHaveAttribute("aria-busy", "true");
    expect(
      within(screen.getByTestId("pulse-middle-content")).getByText(
        "Complete the active Pulse before generating."
      )
    ).toBeInTheDocument();
  });

  it("does not render passive startup guardrail copy before the user triggers generation", () => {
    render(
      <PulseCreatePropertiesPanel
        {...baseProps}
        costCredits={4}
        isGenerateDisabled
        guardrailReason={null}
      />
    );

    expect(screen.getByTestId("pulse-middle-content")).toBeEmptyDOMElement();
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
