import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptStep } from "../../PromptStep";
import { StandardCreatePanelView } from "../StandardCreatePanelView";
import { INTERNAL_REFERENCE_DRAG_ORIGIN, prepareReferenceDrag } from "../../../utils/dragDrop";
import { createCanvasTearOutComposerTargetRegistry } from "../../../hooks/useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../../../logic/agentComposerDirectDropPayload";
import {
  clearInternalReferenceDragSession,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
  registerInternalReferenceDragSession,
} from "../../../../../lib/internalReferenceDragSession";

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

describe("StandardCreatePanelView", () => {
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

  it("blocks wider-panel media drops while Chat Mode is off", () => {
    const onAgentAttachmentDrop = vi.fn();
    const { container } = render(
      <StandardCreatePanelView
        {...baseProps}
        promptStepProps={{
          ...basePromptStepProps,
          chatModeEnabled: false,
          onAgentAttachmentDrop,
        }}
      />
    );

    const panelBody = container.querySelector(".create-composer-right-panel-inner");
    const dropResult = fireEvent.drop(panelBody as Element, {
      dataTransfer: {
        types: ["text/reference-url", "text/plain"],
        getData: (key: string) =>
          key === "text/reference-url"
            ? "https://example.com/reference.png"
            : key === "text/plain"
              ? "Image note"
              : "",
      },
    });

    expect(dropResult).toBe(false);
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
  });

  it("replaces composer text when plain prompt text is dropped on the wider create panel body without Shift", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragEnter = vi.fn();
    const onAgentAttachmentDragOver = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const onAgentInputChange = vi.fn();

    const { container } = render(
      <StandardCreatePanelView
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
    expect(onAgentInputChange).toHaveBeenCalledWith("Dropped prompt text");
  });

  it("replaces composer text with full session-backed prompt text when browser fields are shortened", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentInputChange = vi.fn();

    const { container } = render(
      <StandardCreatePanelView
        {...baseProps}
        promptStepProps={{
          ...basePromptStepProps,
          agentInput: "Existing draft ",
          onAgentAttachmentDrop,
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

    const fullPrompt = `Full create prompt. ${"Detailed reference direction. ".repeat(80)}Final note.`;
    const shortenedPrompt = fullPrompt.slice(0, 1000);
    const token = registerInternalReferenceDragSession({
      version: 1,
      origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
      referenceId: "standard-long-prompt-ref",
      outputId: "standard-long-prompt-ref",
      imageIndex: 0,
      mediaId: null,
      mediaKind: "text",
      promptText: fullPrompt,
      referenceUrl: null,
      sourceSurface: "all-refs",
    });
    const textTransfer = createMutableTransfer();
    textTransfer.setData(INTERNAL_REFERENCE_DRAG_SESSION_TYPE, token);
    textTransfer.setData(INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE, token);
    textTransfer.setData("text/reference-media-kind", "text");
    textTransfer.setData("text/prompt", shortenedPrompt);
    textTransfer.setData("text/plain", shortenedPrompt);

    try {
      act(() => {
        fireEvent.drop(panelBody as Element, { dataTransfer: textTransfer });
      });

      expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
      expect(onAgentInputChange).toHaveBeenCalledWith(fullPrompt);
    } finally {
      clearInternalReferenceDragSession(token);
    }
  });

  it("inserts prompt text when Shift-dropping on the wider create panel body", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragEnter = vi.fn();
    const onAgentAttachmentDragOver = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const onAgentInputChange = vi.fn();

    const { container } = render(
      <StandardCreatePanelView
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
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }));
    });

    const textTransfer = {
      types: ["text/plain"],
      getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
    };

    act(() => {
      fireEvent.dragEnter(panelBody as Element, { dataTransfer: textTransfer });
      fireEvent.dragOver(panelBody as Element, { dataTransfer: textTransfer });
      fireEvent.drop(panelBody as Element, { dataTransfer: textTransfer });
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
    });

    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
    expect(onAgentInputChange).toHaveBeenCalledWith("Existing draft Dropped prompt text");
  });

  it("registers a Canvas tear-out target that accepts text and image payloads", async () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    const onAgentInputChange = vi.fn();
    const onAgentComposerDirectDrop = vi.fn();

    const { container } = render(
      <StandardCreatePanelView
        {...baseProps}
        canvasTearOutTargetRegistry={registry}
        onAgentComposerDirectDrop={onAgentComposerDirectDrop}
        promptStepProps={{
          ...basePromptStepProps,
          agentInput: "Existing draft ",
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
      ).toBe("standard-create-composer")
    );
    act(() => {
      registry.setActiveTarget("standard-create-composer");
    });
    expect(panelBody).toHaveClass("is-drop-active");

    const textTarget = registry.resolveTargetAtPoint(
      { clientX: 20, clientY: 20 },
      { kind: "text", text: "Canvas text" }
    );
    act(() => {
      textTarget?.target.accept({ kind: "text", text: "Canvas text" });
    });

    expect(onAgentInputChange).toHaveBeenCalledWith("Canvas text");

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

  it("does not register Canvas image intake while Chat Mode is off", async () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    const onAgentComposerDirectDrop = vi.fn();
    const { container } = render(
      <StandardCreatePanelView
        {...baseProps}
        canvasTearOutTargetRegistry={registry}
        onAgentComposerDirectDrop={onAgentComposerDirectDrop}
        promptStepProps={{ ...basePromptStepProps, chatModeEnabled: false }}
      />
    );
    const panelRoot = screen.getByRole("group", { name: "Create composer" }) as HTMLElement;
    const panelBody = container.querySelector(".create-composer-right-panel-inner") as HTMLElement;
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
    const imagePayload: AgentComposerDirectDropPayload = {
      kind: "image",
      internalPayload: null,
      composerImagePayload: {
        version: 1,
        origin: "ai-studio-reference-grid",
        referenceId: "canvas-image-off",
        outputId: null,
        mediaId: "media-off",
        displayArtifactUrl: "https://example.com/canvas.png",
        displayArtifactKind: "url",
        sourceSurface: "all-refs",
      },
    };

    await waitFor(() => {
      expect(registry.resolveTargetAtPoint({ clientX: 20, clientY: 20 }, imagePayload)).toBeNull();
    });
    expect(onAgentComposerDirectDrop).not.toHaveBeenCalled();
  });

  it("routes hybrid internal prompt-reference drags from the wider create panel body into the composer", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragEnter = vi.fn();
    const onAgentAttachmentDragOver = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const onAgentInputChange = vi.fn();

    const { container } = render(
      <StandardCreatePanelView
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

  it("expands the active bottom Standard composer upward for long drafts", async () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 900,
    });
    rectSpy.mockImplementation(function (this: HTMLElement) {
      if (this instanceof HTMLTextAreaElement) {
        return {
          x: 0,
          y: 650,
          top: 650,
          bottom: 686,
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
            agentInputMaxHeightPx: 520,
            agentInputVerticalExpansionAnchor: "bottom",
            agentMessages: [
              { id: "assistant-1", role: "assistant", content: "Ready when you are." },
            ],
          }}
        />
      );

      const textbox = screen.getByRole("textbox");

      await waitFor(() => {
        expect(textbox).toHaveStyle({ height: "520px", overflowY: "auto" });
      });
    } finally {
      rectSpy.mockRestore();
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
      }
    }
  });

  it("keeps the Standard composer focused and editable through the first-send shell swap", async () => {
    const onAgentSend = vi.fn();
    const onAgentInputChange = vi.fn();
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    try {
      const { rerender } = render(
        <StandardCreatePanelView
          {...baseProps}
          promptStepProps={{
            ...basePromptStepProps,
            agentInput: "First turn",
            onAgentSend,
            onAgentInputChange,
          }}
        />
      );

      const initialTextbox = screen.getByRole("textbox");
      fireEvent.focus(initialTextbox);
      fireEvent.keyDown(initialTextbox, { key: "Enter" });

      expect(onAgentSend).toHaveBeenCalledTimes(1);

      rerender(
        <StandardCreatePanelView
          {...baseProps}
          promptStepProps={{
            ...basePromptStepProps,
            agentInput: "Draft while thinking",
            onAgentSend,
            onAgentInputChange,
            agentIsSending: true,
            agentMessages: [
              {
                id: "user-1",
                role: "user",
                content: "First turn",
              },
            ],
          }}
        />
      );

      const activeTextbox = screen.getByRole("textbox");
      await waitFor(() => {
        expect(activeTextbox).toHaveFocus();
      });
      expect(activeTextbox).not.toBeDisabled();

      fireEvent.change(activeTextbox, { target: { value: "Still typing..." } });
      expect(onAgentInputChange).toHaveBeenCalledWith("Still typing...");
    } finally {
      requestAnimationFrameSpy.mockRestore();
    }
  });
});
