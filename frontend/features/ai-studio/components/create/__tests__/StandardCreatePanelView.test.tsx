import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptStep } from "../../PromptStep";
import { StandardCreatePanelView } from "../StandardCreatePanelView";

class MockResizeObserver {
  observe() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

const basePromptStepProps: React.ComponentProps<typeof PromptStep> = {
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

const baseProps: React.ComponentProps<typeof StandardCreatePanelView> = {
  promptStepProps: basePromptStepProps,
  characterModeEnabled: false,
  onCharacterModeEnabledToggle: vi.fn(),
  onCharacterPickerOpen: vi.fn(),
  characterSelectDisabled: false,
  isCharacterSelectionEmpty: true,
  selectedCharacterName: "No Characters",
  selectedCharacterDisplayName: "No Characters",
  selectedCharacterProfileImageUrl: null,
  selectedCharacterInitials: null,
  isCharacterPickerOpen: false,
  isCreateModelPickerOpen: false,
  isModelSelectionEmpty: false,
  onCreateModelOpen: vi.fn(),
  useUnoptimizedModelLogo: false,
  effectiveModelLabel: "Seedream 4.5",
  aspect: "9:16",
  aspectOptionsForModel: [
    { value: "9:16", ratioLabel: "9:16", name: "Portrait", orientation: "vertical" },
  ],
  onAspectChange: vi.fn(),
  showCreateControlSet: false,
  shouldShowImageResolutionCard: false,
  imageResolutionValue: "model_default",
  imageResolutionOptions: [],
};

describe("StandardCreatePanelView", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("accepts media drops from the wider create panel body", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragEnter = vi.fn();
    const onAgentAttachmentDragOver = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();

    const { container } = render(
      <StandardCreatePanelView
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
      <StandardCreatePanelView
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

  it("renders the no-history shell with a centered composer stack", () => {
    const { container } = render(<StandardCreatePanelView {...baseProps} />);

    const shell = container.querySelector(".create-composer-empty-state-shell");
    const centerStack = container.querySelector(".create-composer-empty-center-stack");
    const composerBlock = centerStack?.querySelector(".create-composer-bottom-block");

    expect(shell).toBeTruthy();
    expect(centerStack).toBeTruthy();
    expect(composerBlock).toBeTruthy();
  });

  it("keeps an expanded Standard create draft open after blur", async () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const minHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "minHeight"
    );
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 220,
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", {
      configurable: true,
      get() {
        return "36px";
      },
    });
    rectSpy.mockImplementation(function (this: HTMLElement) {
      if (this instanceof HTMLTextAreaElement) {
        return {
          x: 0,
          y: 240,
          top: 240,
          bottom: 276,
          left: 0,
          right: 400,
          width: 400,
          height: 36,
          toJSON: () => ({}),
        } as DOMRect;
      }
      if ((this as HTMLElement).classList?.contains("create-composer-right-panel-inner")) {
        return {
          x: 0,
          y: 0,
          top: 0,
          bottom: 720,
          left: 0,
          right: 420,
          width: 420,
          height: 720,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        bottom: 800,
        left: 0,
        right: 1280,
        width: 1280,
        height: 800,
        toJSON: () => ({}),
      } as DOMRect;
    });

    try {
      render(
        <StandardCreatePanelView
          {...baseProps}
          promptStepProps={{
            ...basePromptStepProps,
            agentInput: "Existing draft",
            agentInputCollapseOnBlur: false,
          }}
        />
      );

      const textbox = screen.getByRole("textbox");

      await waitFor(() => {
        expect(textbox).toHaveStyle({ height: "220px", overflowY: "hidden" });
      });

      fireEvent.focus(textbox);
      fireEvent.blur(textbox);

      await waitFor(() => {
        expect(textbox).toHaveStyle({ height: "220px", overflowY: "hidden" });
      });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
      }
      rectSpy.mockRestore();
      if (minHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", minHeightDescriptor);
      } else {
        Reflect.deleteProperty(CSSStyleDeclaration.prototype, "minHeight");
      }
    }
  });
});
