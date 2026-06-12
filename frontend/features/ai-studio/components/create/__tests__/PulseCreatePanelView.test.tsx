import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PulsePromptStep } from "../../PulsePromptStep";
import { PulseCreatePanelView } from "../PulseCreatePanelView";
import { prepareReferenceDrag } from "../../../utils/dragDrop";
import { createCanvasTearOutComposerTargetRegistry } from "../../../hooks/useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../../../logic/agentComposerDirectDropPayload";

vi.mock("../CreatePulsePresetPanel", () => ({
  CreatePulsePresetPanel: () => <div data-testid="pulse-presets-panel" />,
}));

class MockResizeObserver {
  observe() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

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
    deletedBuiltInPresetIds: [],
    builtInDefinitions: [],
    builtInDefinitionsLoading: false,
    builtInDefinitionsAuthoritative: true,
    refreshBuiltInDefinitions: vi.fn(async () => []),
    setPresetPanelIds: vi.fn(async () => true),
    setSavedPresets: vi.fn(async () => true),
    restoreDeletedBuiltInPresetIds: vi.fn(async () => true),
  },
};

const createMutableTransfer = () => {
  const store = new Map<string, string>();
  return {
    files: { length: 0, item: () => null } as unknown as FileList,
    get types() {
      return Array.from(store.keys());
    },
    getData: (type: string) => store.get(type) ?? "",
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
    setDragImage: vi.fn(),
    effectAllowed: "all",
  } as unknown as DataTransfer;
};

describe("PulseCreatePanelView", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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

  it("routes plain prompt-text drops from the wider create panel body into the composer", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragEnter = vi.fn();
    const onAgentAttachmentDragOver = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const onAgentInputChange = vi.fn();

    const { container } = render(
      <PulseCreatePanelView
        {...baseProps}
        promptStepProps={{
          ...basePromptStepProps,
          agentInput: "Existing draft ",
          onAgentAttachmentDrop,
          onAgentAttachmentDragEnter,
          onAgentAttachmentDragOver,
          onAgentAttachmentDragLeave,
          onAgentInputChange,
        }}
      />
    );

    const panelBody = container.querySelector(".create-composer-right-panel-inner");
    const composerInput = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(panelBody).toBeTruthy();
    act(() => {
      composerInput.focus();
      composerInput.setSelectionRange("Existing draft ".length, "Existing draft ".length);
    });

    const textTransfer = {
      types: ["text/plain"],
      getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
    };

    act(() => {
      fireEvent.dragEnter(panelBody as Element, { dataTransfer: textTransfer });
      fireEvent.dragOver(panelBody as Element, { dataTransfer: textTransfer });
      fireEvent.dragLeave(panelBody as Element, { dataTransfer: textTransfer });
      fireEvent.drop(panelBody as Element, { dataTransfer: textTransfer });
    });

    expect(onAgentAttachmentDragEnter).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragOver).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragLeave).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
    expect(onAgentInputChange).toHaveBeenCalledWith("Existing draft Dropped prompt text");
  });

  it("registers a Canvas tear-out target that accepts text and image payloads", async () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    const onAgentInputChange = vi.fn();
    const onAgentComposerDirectDrop = vi.fn();

    const { container } = render(
      <PulseCreatePanelView
        {...baseProps}
        canvasTearOutTargetRegistry={registry}
        onAgentComposerDirectDrop={onAgentComposerDirectDrop}
        promptStepProps={{
          ...basePromptStepProps,
          agentInput: "Existing pulse draft ",
          onAgentInputChange,
        }}
      />
    );

    const panelRoot = screen.getByRole("group", { name: "Create composer" }) as HTMLElement;
    const panelBody = container.querySelector(".create-composer-right-panel-inner") as HTMLElement;
    expect(panelRoot).toBeTruthy();
    expect(panelBody).toBeTruthy();
    panelRoot.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 10,
          top: 10,
          right: 410,
          bottom: 410,
          width: 400,
          height: 400,
          x: 10,
          y: 10,
          toJSON: () => ({}),
        }) as DOMRect
    );
    panelBody.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 240,
          top: 240,
          right: 340,
          bottom: 340,
          width: 100,
          height: 100,
          x: 240,
          y: 240,
          toJSON: () => ({}),
        }) as DOMRect
    );

    await waitFor(() =>
      expect(
        registry.resolveTargetAtPoint(
          { clientX: 20, clientY: 20 },
          { kind: "text", text: "Canvas text" }
        )?.id
      ).toBe("pulse-create-composer")
    );
    act(() => {
      registry.setActiveTarget("pulse-create-composer");
    });
    expect(panelBody).toHaveClass("is-drop-active");

    const textTarget = registry.resolveTargetAtPoint(
      { clientX: 20, clientY: 20 },
      { kind: "text", text: "Canvas text" }
    );
    act(() => {
      textTarget?.target.accept({ kind: "text", text: "Canvas text" });
    });

    expect(onAgentInputChange).toHaveBeenCalledWith("Existing pulse draft Canvas text");

    const imagePayload: AgentComposerDirectDropPayload = {
      kind: "image",
      internalPayload: null,
      composerImagePayload: {
        version: 1,
        origin: "ai-studio-reference-grid",
        referenceId: "canvas-image",
        outputId: null,
        mediaId: "media-1",
        displayArtifactUrl: "https://example.com/canvas.png",
        displayArtifactKind: "url",
        sourceSurface: "all-refs",
      },
    };
    const imageTarget = registry.resolveTargetAtPoint({ clientX: 20, clientY: 20 }, imagePayload);
    act(() => {
      imageTarget?.target.accept(imagePayload);
    });

    expect(onAgentComposerDirectDrop).toHaveBeenCalledWith(imagePayload);
    act(() => {
      registry.clearActiveTarget();
    });
    expect(panelBody).not.toHaveClass("is-drop-active");
  });

  it("routes hybrid internal prompt-reference drags from the wider create panel body into the composer", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragEnter = vi.fn();
    const onAgentAttachmentDragOver = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const onAgentInputChange = vi.fn();

    const { container } = render(
      <PulseCreatePanelView
        {...baseProps}
        promptStepProps={{
          ...basePromptStepProps,
          onAgentAttachmentDrop,
          onAgentAttachmentDragEnter,
          onAgentAttachmentDragOver,
          onAgentAttachmentDragLeave,
          onAgentInputChange,
        }}
      />
    );

    const panelBody = container.querySelector(".create-composer-right-panel-inner");
    expect(panelBody).toBeTruthy();

    const transfer = createMutableTransfer();
    prepareReferenceDrag(
      {
        currentTarget: panelBody as HTMLElement,
        dataTransfer: transfer,
      } as unknown as React.DragEvent<HTMLElement>,
      {
        id: "prompt-ref-1",
        prompt: "Prompt reference text",
        previewText: "Prompt reference text",
        mode: "text",
        aspect: "1:1",
        model: "Test model",
        status: "ready",
        timestamp: "now",
      } as never,
      {
        dragImage: panelBody as HTMLElement,
        sourceSurface: "all-refs",
      }
    );

    act(() => {
      fireEvent.dragEnter(panelBody as Element, { dataTransfer: transfer });
      fireEvent.dragOver(panelBody as Element, { dataTransfer: transfer });
      fireEvent.drop(panelBody as Element, { dataTransfer: transfer });
    });

    expect(onAgentAttachmentDragEnter).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragOver).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragLeave).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
    expect(onAgentInputChange).toHaveBeenCalledWith("Prompt reference text");
  });

  it("keeps an expanded Pulse create draft open after blur", async () => {
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
        <PulseCreatePanelView
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
