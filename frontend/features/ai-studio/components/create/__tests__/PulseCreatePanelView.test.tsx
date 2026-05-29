import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulsePromptStep } from "../../PulsePromptStep";
import { PulseCreatePanelView } from "../PulseCreatePanelView";

vi.mock("../CreatePulsePresetPanel", () => ({
  CreatePulsePresetPanel: () => <div data-testid="pulse-presets-panel" />,
}));

const basePromptStepProps: React.ComponentProps<typeof PulsePromptStep> = {
  stepNumber: "1",
  prompt: "",
  onPromptChange: vi.fn(),
  isCollapsed: false,
  onToggleCollapse: vi.fn(),
  chatOnly: true,
  agentEnabled: true,
  agentAttachmentDropTarget: "input",
  onAgentInputChange: vi.fn(),
};

const baseProps: React.ComponentProps<typeof PulseCreatePanelView> = {
  promptStepProps: basePromptStepProps,
  isPromptGenerating: false,
  pulsePreferenceRuntime: {
    presetPanelIds: [],
    savedPresets: [],
    builtInDefinitions: [],
    builtInDefinitionsLoading: false,
    builtInDefinitionsAuthoritative: true,
    refreshBuiltInDefinitions: vi.fn(async () => []),
    setPresetPanelIds: vi.fn(async () => true),
    setSavedPresets: vi.fn(async () => true),
  },
};

describe("PulseCreatePanelView", () => {
  it("accepts media drops from the wider create panel body", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragEnter = vi.fn();
    const onAgentAttachmentDragOver = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();

    const { container } = render(
      <PulseCreatePanelView
        {...baseProps}
        promptStepProps={{
          ...basePromptStepProps,
          onAgentAttachmentDrop,
          onAgentAttachmentDragEnter,
          onAgentAttachmentDragOver,
          onAgentAttachmentDragLeave,
        }}
      />
    );

    const panelBody = container.querySelector(".create-composer-right-panel-inner");
    expect(panelBody).toBeTruthy();

    const mediaTransfer = {
      types: ["text/reference-url", "text/plain"],
      getData: (key: string) =>
        key === "text/reference-url"
          ? "https://example.com/reference.png"
          : key === "text/plain"
            ? "Image note"
            : "",
    };

    fireEvent.dragEnter(panelBody as Element, { dataTransfer: mediaTransfer });
    fireEvent.dragOver(panelBody as Element, { dataTransfer: mediaTransfer });
    fireEvent.dragLeave(panelBody as Element, { dataTransfer: mediaTransfer });
    fireEvent.drop(panelBody as Element, { dataTransfer: mediaTransfer });

    expect(onAgentAttachmentDragEnter).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragOver).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragLeave).not.toHaveBeenCalled();
    expect(onAgentAttachmentDrop).toHaveBeenCalledTimes(1);
  });

  it("ignores prompt-text drops on the wider create panel body", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragEnter = vi.fn();
    const onAgentAttachmentDragOver = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();

    const { container } = render(
      <PulseCreatePanelView
        {...baseProps}
        promptStepProps={{
          ...basePromptStepProps,
          onAgentAttachmentDrop,
          onAgentAttachmentDragEnter,
          onAgentAttachmentDragOver,
          onAgentAttachmentDragLeave,
        }}
      />
    );

    const panelBody = container.querySelector(".create-composer-right-panel-inner");
    expect(panelBody).toBeTruthy();

    const textTransfer = {
      types: ["text/plain"],
      getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
    };

    fireEvent.dragEnter(panelBody as Element, { dataTransfer: textTransfer });
    fireEvent.dragOver(panelBody as Element, { dataTransfer: textTransfer });
    fireEvent.dragLeave(panelBody as Element, { dataTransfer: textTransfer });
    fireEvent.drop(panelBody as Element, { dataTransfer: textTransfer });

    expect(onAgentAttachmentDragEnter).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragOver).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragLeave).not.toHaveBeenCalled();
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
  });
});
