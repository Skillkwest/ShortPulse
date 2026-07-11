/**
 * PromptStep action-surface tests.
 * Verifies structured agent actions are rendered and routed to callbacks.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromptStep } from "../PromptStep";
import { PulsePromptStep } from "../PulsePromptStep";

const baseProps = {
  stepNumber: 1,
  prompt: "base prompt",
  onPromptChange: vi.fn(),
  isCollapsed: false,
  onToggleCollapse: vi.fn(),
  chatOnly: true as const,
  agentEnabled: true,
  agentMessages: [],
  agentInput: "",
  onAgentInputChange: vi.fn(),
  onAgentSend: vi.fn(),
};

describe("PromptStep agent actions", () => {
  it("renders chat mode toggle as enabled by default and forwards toggle intent", () => {
    const onChatModeEnabledChange = vi.fn();

    render(<PromptStep {...baseProps} onChatModeEnabledChange={onChatModeEnabledChange} />);

    const toggle = screen.getByRole("button", { name: "Disable chat mode" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(onChatModeEnabledChange).toHaveBeenCalledWith(false);
  });

  it("renders the chat mode label without helper-text class", () => {
    render(<PromptStep {...baseProps} />);

    const label = screen.getByText("Chat Mode");
    expect(label).toHaveClass("agent-chat-mode-label");
    expect(label).not.toHaveClass("helper-text");
  });

  it("uses agent copy for the chat composer", () => {
    render(<PromptStep {...baseProps} />);

    expect(screen.queryByText("Agent Assist")).toBeNull();
    expect(screen.getByPlaceholderText("Message the agent...")).toBeInTheDocument();
  });

  it("disables send affordances when chat mode is off", () => {
    const onAgentSend = vi.fn();
    render(<PromptStep {...baseProps} chatModeEnabled={false} onAgentSend={onAgentSend} />);

    const composer = screen.getByRole("textbox");
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(onAgentSend).not.toHaveBeenCalled();

    expect(screen.queryByRole("button", { name: "Send to agent" })).toBeNull();
    expect(
      screen.queryByText("Chat Mode is off. Generate uses your text exactly; agent rewrite is off.")
    ).toBeNull();
  });

  it("replaces prompt textarea text when prompt text is dropped without Shift", () => {
    const onPromptChange = vi.fn();
    render(
      <PromptStep
        {...baseProps}
        chatOnly={false}
        chatModeEnabled={false}
        prompt="Existing prompt"
        onPromptChange={onPromptChange}
      />
    );

    const composer = screen.getByRole("textbox");
    const dataTransfer = {
      types: ["text/plain"],
      getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
    };
    const dropEvent = new MouseEvent("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", { value: dataTransfer });
    fireEvent(composer, dropEvent);

    expect(onPromptChange).toHaveBeenCalledWith("Dropped prompt text");
  });

  it("inserts prompt textarea text at the caret when Shift is held", () => {
    const onPromptChange = vi.fn();
    render(
      <PromptStep
        {...baseProps}
        chatOnly={false}
        chatModeEnabled={false}
        prompt="Existing prompt"
        onPromptChange={onPromptChange}
      />
    );

    const composer = screen.getByRole("textbox") as HTMLTextAreaElement;
    act(() => {
      composer.focus();
      composer.setSelectionRange("Existing ".length, "Existing ".length);
    });
    const dataTransfer = {
      types: ["text/plain"],
      getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
    };
    const dropEvent = new MouseEvent("drop", {
      bubbles: true,
      cancelable: true,
      shiftKey: true,
    });
    Object.defineProperty(dropEvent, "dataTransfer", { value: dataTransfer });
    fireEvent(composer, dropEvent);

    expect(onPromptChange).toHaveBeenCalledWith("Existing Dropped prompt textprompt");
  });

  it("inserts prompt textarea text when Shift is held even if the drop event loses shiftKey", () => {
    const onPromptChange = vi.fn();
    render(
      <PromptStep
        {...baseProps}
        chatOnly={false}
        chatModeEnabled={false}
        prompt="Existing prompt"
        onPromptChange={onPromptChange}
      />
    );

    const composer = screen.getByRole("textbox") as HTMLTextAreaElement;
    act(() => {
      composer.focus();
      composer.setSelectionRange("Existing ".length, "Existing ".length);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }));
    });
    const dataTransfer = {
      types: ["text/plain"],
      getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
    };
    const dropEvent = new MouseEvent("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", { value: dataTransfer });
    fireEvent(composer, dropEvent);
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));

    expect(onPromptChange).toHaveBeenCalledWith("Existing Dropped prompt textprompt");
  });

  it("disables send affordances while agent bootstrap is pending", () => {
    render(<PromptStep {...baseProps} agentBootstrapPending />);

    expect(screen.getByRole("button", { name: "Send to agent" })).toBeDisabled();
  });

  it("blocks Standard chat send while an attached image is still preparing", () => {
    const onAgentSend = vi.fn();
    render(
      <PromptStep
        {...baseProps}
        agentInput="Analyze this image"
        onAgentSend={onAgentSend}
        stagedAttachments={[
          {
            id: "img-1",
            kind: "image",
            imageUrl: "data:image/png;base64,preview",
            submissionImageUrl: null,
            text: null,
            deliveryStatus: "preparing",
            deliveryError: null,
          },
        ]}
      />
    );

    const composer = screen.getByPlaceholderText("Message the agent...");
    fireEvent.keyDown(composer, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Send to agent" }));

    expect(onAgentSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send to agent" })).toBeDisabled();
  });

  it("does not render inline generate in chat-off mode", () => {
    render(
      <PromptStep {...baseProps} chatModeEnabled={false} agentInput="a clear product prompt" />
    );

    expect(screen.queryByRole("button", { name: "Generate with current prompt" })).toBeNull();
  });

  it("does not render prefab-backed inline generate in chat-off mode", () => {
    render(
      <PromptStep {...baseProps} chatModeEnabled={false} agentInput="a clear product prompt" />
    );

    expect(screen.queryByRole("button", { name: "Generate with current prompt" })).toBeNull();
  });

  it("hides inline generate while chat mode is enabled", () => {
    render(<PromptStep {...baseProps} />);

    expect(screen.queryByRole("button", { name: "Generate with current prompt" })).toBeNull();
  });

  it("keeps response output previews in the Standard response layout when chat mode is off", () => {
    render(
      <PromptStep
        {...baseProps}
        chatModeEnabled={false}
        agentMessages={[
          {
            id: "assistant-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
          },
        ]}
        assistantBubbleMedia={{
          "assistant-1": {
            outputId: "out-pending",
            thumbnailUrl: null,
            state: "pending",
          },
        }}
      />
    );

    expect(screen.queryByRole("button", { name: "Generate from this agent output" })).toBeNull();
    expect(screen.getByText("Generating preview…")).toBeInTheDocument();
    const messageBubble = screen.getByText("Assistant output one.").closest(".agent-message");
    expect(messageBubble).toHaveClass("agent-message--with-output-generate");
    expect(messageBubble).toHaveClass("agent-message--with-output-thumbnail");
  });

  it("shows the drag-to-composer handoff hint after a promptable assistant reply in chat mode", () => {
    render(
      <PromptStep
        {...baseProps}
        chatModeEnabled
        agentInput=""
        agentMessages={[
          {
            id: "assistant-prompt",
            role: "assistant",
            content: "A cinematic product photo with crisp blue rim light.",
            outputPrompt: "A cinematic product photo with crisp blue rim light.",
            canUseAsPrompt: true,
          },
        ]}
      />
    );

    expect(screen.queryByRole("button", { name: "Generate from this agent output" })).toBeNull();
    expect(
      screen.getByText(
        "Drag agent text into the composer to enable Generate. Enter sends chat. Shift+Enter adds a new line."
      )
    ).toBeInTheDocument();
  });

  it("can suppress the chat composer helper hint for Standard Create chat mode", () => {
    render(<PromptStep {...baseProps} hideChatComposerHint />);

    expect(screen.queryByText("Enter sends chat. Shift+Enter adds a new line.")).toBeNull();
  });

  it("renders promptable Standard assistant replies as draggable history bubbles", () => {
    render(
      <PromptStep
        {...baseProps}
        chatModeEnabled
        agentMessages={[
          {
            id: "assistant-prompt",
            role: "assistant",
            content: "A cinematic product photo with crisp blue rim light.",
            outputPrompt: "A cinematic product photo with crisp blue rim light.",
            canUseAsPrompt: true,
          },
        ]}
      />
    );

    const promptBubble = screen
      .getByText("A cinematic product photo with crisp blue rim light.")
      .closest(".agent-message");
    const promptDragSurface = screen
      .getByText("A cinematic product photo with crisp blue rim light.")
      .closest(".agent-message-prompt-drag-surface");

    expect(promptBubble).toHaveClass("is-draggable");
    expect(promptBubble).toHaveAttribute("draggable", "false");
    expect(promptDragSurface).toHaveAttribute("draggable", "true");
  });

  it("marks only usable assistant prompt outputs for prompt-color styling", () => {
    render(
      <PromptStep
        {...baseProps}
        agentMessages={[
          {
            id: "assistant-conversation",
            role: "assistant",
            content: "I can help refine that direction.",
            canUseAsPrompt: false,
          },
          {
            id: "assistant-prompt",
            role: "assistant",
            content: "A cinematic product photo with crisp blue rim light.",
            outputPrompt: "A cinematic product photo with crisp blue rim light.",
            canUseAsPrompt: true,
          },
        ]}
      />
    );

    const conversationBubble = screen
      .getByText("I can help refine that direction.")
      .closest(".agent-message");
    const promptBubble = screen
      .getByText("A cinematic product photo with crisp blue rim light.")
      .closest(".agent-message");

    expect(conversationBubble).not.toHaveClass("agent-message--prompt-output");
    expect(promptBubble).toHaveClass("agent-message--prompt-output");
  });

  it("does not render inline generate in chat-off mode when input is empty", () => {
    render(<PromptStep {...baseProps} prompt="" chatModeEnabled={false} agentInput="" />);

    expect(screen.queryByRole("button", { name: "Generate with current prompt" })).toBeNull();
  });

  it("does not render inline generate in chat-off mode when the shared prompt can be used", () => {
    render(
      <PromptStep
        {...baseProps}
        prompt="shared fallback prompt"
        chatModeEnabled={false}
        agentInput=""
      />
    );

    expect(screen.queryByRole("button", { name: "Generate with current prompt" })).toBeNull();
  });

  it("does not show chat-off inline generate guardrails once the inline action is removed", () => {
    render(
      <PromptStep
        {...baseProps}
        chatModeEnabled={false}
        agentInput="a clear product prompt"
        disableOutputGenerate
        outputGenerateGuardrailReason="Select a model before generating."
      />
    );

    expect(screen.queryByText("Select a model before generating.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Generate with current prompt" })).toBeNull();
  });

  it("keeps inline chat visible in chat-only mode", () => {
    render(<PromptStep {...baseProps} />);

    expect(screen.getByPlaceholderText("Message the agent...")).toBeInTheDocument();
  });

  it("limits Standard prompt-text drops to the visible composer shell", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragOver = vi.fn();
    const onAgentAttachmentDragEnter = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const onAgentInputChange = vi.fn();
    const { container } = render(
      <PromptStep
        {...baseProps}
        agentAttachmentDropTarget="input"
        onAgentAttachmentDrop={onAgentAttachmentDrop}
        onAgentAttachmentDragOver={onAgentAttachmentDragOver}
        onAgentAttachmentDragEnter={onAgentAttachmentDragEnter}
        onAgentAttachmentDragLeave={onAgentAttachmentDragLeave}
        onAgentInputChange={onAgentInputChange}
      />
    );

    const chatSurface = container.querySelector(".agent-chat-surface");
    const inputShell = container.querySelector(".agent-composer-input-shell");
    const promptStep = container.querySelector(".prompt-step");
    expect(chatSurface).toBeTruthy();
    expect(inputShell).toBeTruthy();
    expect(promptStep).toBeTruthy();

    fireEvent.dragEnter(chatSurface as Element);
    fireEvent.dragOver(chatSurface as Element);
    fireEvent.dragLeave(chatSurface as Element);
    fireEvent.drop(chatSurface as Element, {
      dataTransfer: {
        types: ["text/plain"],
        getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
      },
    });
    expect(onAgentAttachmentDragEnter).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragOver).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragLeave).not.toHaveBeenCalled();
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
    expect(onAgentInputChange).not.toHaveBeenCalled();

    vi.clearAllMocks();

    fireEvent.dragEnter(inputShell as Element);
    fireEvent.dragOver(inputShell as Element);
    fireEvent.dragLeave(inputShell as Element);
    fireEvent.drop(inputShell as Element);
    expect(onAgentAttachmentDragEnter).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragOver).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragLeave).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDrop).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    fireEvent.dragEnter(promptStep as Element);
    fireEvent.dragOver(promptStep as Element);
    fireEvent.dragLeave(promptStep as Element);
    fireEvent.drop(promptStep as Element, {
      dataTransfer: {
        types: ["text/plain"],
        getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
      },
    });
    expect(onAgentAttachmentDragEnter).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragOver).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragLeave).not.toHaveBeenCalled();
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
    expect(onAgentInputChange).not.toHaveBeenCalled();
  });

  it("limits Pulse prompt-text drops to the visible composer shell", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragOver = vi.fn();
    const onAgentAttachmentDragEnter = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const onAgentInputChange = vi.fn();
    const { container } = render(
      <PulsePromptStep
        stepNumber="1"
        prompt=""
        onPromptChange={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        chatOnly
        agentEnabled
        agentAttachmentDropTarget="input"
        onAgentAttachmentDrop={onAgentAttachmentDrop}
        onAgentAttachmentDragOver={onAgentAttachmentDragOver}
        onAgentAttachmentDragEnter={onAgentAttachmentDragEnter}
        onAgentAttachmentDragLeave={onAgentAttachmentDragLeave}
        onAgentInputChange={onAgentInputChange}
      />
    );

    const chatSurface = container.querySelector(".agent-chat-surface");
    const inputShell = container.querySelector(".agent-composer-input-shell");
    const promptStep = container.querySelector(".prompt-step");
    expect(chatSurface).toBeTruthy();
    expect(inputShell).toBeTruthy();
    expect(promptStep).toBeTruthy();

    fireEvent.dragEnter(chatSurface as Element);
    fireEvent.dragOver(chatSurface as Element);
    fireEvent.dragLeave(chatSurface as Element);
    fireEvent.drop(chatSurface as Element, {
      dataTransfer: {
        types: ["text/plain"],
        getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
      },
    });
    expect(onAgentAttachmentDragEnter).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragOver).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragLeave).not.toHaveBeenCalled();
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
    expect(onAgentInputChange).not.toHaveBeenCalled();

    vi.clearAllMocks();

    fireEvent.dragEnter(inputShell as Element);
    fireEvent.dragOver(inputShell as Element);
    fireEvent.dragLeave(inputShell as Element);
    fireEvent.drop(inputShell as Element);
    expect(onAgentAttachmentDragEnter).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragOver).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragLeave).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDrop).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    fireEvent.dragEnter(promptStep as Element);
    fireEvent.dragOver(promptStep as Element);
    fireEvent.dragLeave(promptStep as Element);
    fireEvent.drop(promptStep as Element, {
      dataTransfer: {
        types: ["text/plain"],
        getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
      },
    });
    expect(onAgentAttachmentDragEnter).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragOver).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragLeave).not.toHaveBeenCalled();
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
    expect(onAgentInputChange).not.toHaveBeenCalled();
  });

  it("blocks Pulse chat send while an attached image is still preparing", () => {
    const onAgentSend = vi.fn();
    render(
      <PulsePromptStep
        stepNumber="1"
        prompt=""
        onPromptChange={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        chatOnly
        agentEnabled
        agentInput="Analyze this image"
        onAgentInputChange={vi.fn()}
        onAgentSend={onAgentSend}
        stagedAttachments={[
          {
            id: "img-1",
            kind: "image",
            imageUrl: "data:image/png;base64,preview",
            submissionImageUrl: null,
            text: null,
            deliveryStatus: "preparing",
            deliveryError: null,
          },
        ]}
      />
    );

    const composer = screen.getByPlaceholderText("Message the agent...");
    fireEvent.keyDown(composer, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Send to agent" }));

    expect(onAgentSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send to agent" })).toBeDisabled();
  });

  it("blocks Pulse composer drops while an attached image is still preparing", () => {
    const onAgentAttachmentDrop = vi.fn();
    const { container } = render(
      <PulsePromptStep
        stepNumber="1"
        prompt=""
        onPromptChange={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        chatOnly
        agentEnabled
        agentAttachmentDropTarget="input"
        onAgentAttachmentDrop={onAgentAttachmentDrop}
        onAgentInputChange={vi.fn()}
        stagedAttachments={[
          {
            id: "img-1",
            kind: "image",
            imageUrl: "data:image/png;base64,preview",
            submissionImageUrl: null,
            text: null,
            deliveryStatus: "preparing",
            deliveryError: null,
          },
        ]}
      />
    );

    const inputShell = container.querySelector(".agent-composer-input-shell");
    expect(inputShell).toBeTruthy();
    const dataTransfer = {
      files: [new File(["image"], "late.png", { type: "image/png" })],
      types: ["Files"],
      getData: () => "",
      dropEffect: "copy",
    };

    fireEvent.drop(inputShell as Element, { dataTransfer });

    expect(dataTransfer.dropEffect).toBe("none");
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
    expect(
      screen.getByText("Wait for the current image or Pulse reply before adding another image.")
    ).toBeVisible();
  });

  it("disables Pulse send affordances while Pulse-owned loading is active", () => {
    const onAgentSend = vi.fn();
    render(
      <PulsePromptStep
        stepNumber="1"
        prompt=""
        onPromptChange={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        chatOnly
        agentEnabled
        agentInput="Keep going"
        onAgentInputChange={vi.fn()}
        onAgentSend={onAgentSend}
        useFlowComposerLayout
        pulseLoadingState={{
          phase: "generating_step",
          title: "Generating...",
        }}
      />
    );

    const composer = screen.getByPlaceholderText("Pulse is generating the next response...");
    const sendButton = screen.getByRole("button", { name: "Send to agent" });

    expect(composer).toBeDisabled();
    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);
    expect(onAgentSend).not.toHaveBeenCalled();
  });

  it("blocks Pulse composer drops while the agent is sending", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragOver = vi.fn();
    const onAgentAttachmentDragEnter = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const { container } = render(
      <PulsePromptStep
        stepNumber="1"
        prompt=""
        onPromptChange={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        chatOnly
        agentEnabled
        agentAttachmentDropTarget="input"
        agentIsSending
        onAgentAttachmentDrop={onAgentAttachmentDrop}
        onAgentAttachmentDragOver={onAgentAttachmentDragOver}
        onAgentAttachmentDragEnter={onAgentAttachmentDragEnter}
        onAgentAttachmentDragLeave={onAgentAttachmentDragLeave}
        onAgentInputChange={vi.fn()}
      />
    );

    const inputShell = container.querySelector(".agent-composer-input-shell");
    expect(inputShell).toBeTruthy();
    const dataTransfer = {
      files: [new File(["image"], "late.png", { type: "image/png" })],
      types: ["Files"],
      getData: () => "",
      dropEffect: "copy",
    };

    fireEvent.dragEnter(inputShell as Element, { dataTransfer });
    fireEvent.dragOver(inputShell as Element, { dataTransfer });
    fireEvent.drop(inputShell as Element, { dataTransfer });

    expect(dataTransfer.dropEffect).toBe("none");
    expect(onAgentAttachmentDragEnter).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragOver).not.toHaveBeenCalled();
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
    expect(
      screen.getByText("Wait for the current image or Pulse reply before adding another image.")
    ).toBeVisible();
  });

  it("replaces Standard composer text when prompt text is dropped without Shift", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const onAgentInputChange = vi.fn();
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    try {
      const { container } = render(
        <PromptStep
          {...baseProps}
          agentInput="Existing draft "
          agentAttachmentDropTarget="input"
          onAgentAttachmentDrop={onAgentAttachmentDrop}
          onAgentAttachmentDragLeave={onAgentAttachmentDragLeave}
          onAgentInputChange={onAgentInputChange}
        />
      );

      const inputShell = container.querySelector(".agent-composer-input-shell");
      const composerInput = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(inputShell).toBeTruthy();
      act(() => {
        composerInput.focus();
        composerInput.setSelectionRange("Existing draft ".length, "Existing draft ".length);
      });

      act(() => {
        fireEvent.drop(inputShell as Element, {
          dataTransfer: {
            types: ["text/plain"],
            getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
          },
        });
      });

      expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
      expect(onAgentAttachmentDragLeave).toHaveBeenCalledTimes(1);
      expect(onAgentInputChange).toHaveBeenCalledWith("Dropped prompt text");
      expect(composerInput).toHaveFocus();
    } finally {
      requestAnimationFrameSpy.mockRestore();
    }
  });

  it("inserts Standard composer text when prompt text is Shift-dropped on the input shell", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const onAgentInputChange = vi.fn();
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    try {
      const { container } = render(
        <PromptStep
          {...baseProps}
          agentInput="Existing draft "
          agentAttachmentDropTarget="input"
          onAgentAttachmentDrop={onAgentAttachmentDrop}
          onAgentAttachmentDragLeave={onAgentAttachmentDragLeave}
          onAgentInputChange={onAgentInputChange}
        />
      );

      const inputShell = container.querySelector(".agent-composer-input-shell");
      const composerInput = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(inputShell).toBeTruthy();
      act(() => {
        composerInput.focus();
        composerInput.setSelectionRange("Existing draft ".length, "Existing draft ".length);
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }));
      });

      act(() => {
        fireEvent.drop(inputShell as Element, {
          dataTransfer: {
            types: ["text/plain"],
            getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
          },
        });
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
      });

      expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
      expect(onAgentAttachmentDragLeave).toHaveBeenCalledTimes(1);
      expect(onAgentInputChange).toHaveBeenCalledWith("Existing draft Dropped prompt text");
      expect(composerInput).toHaveFocus();
    } finally {
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
      requestAnimationFrameSpy.mockRestore();
    }
  });

  it("treats explicit prompt drags with synthetic browser files as text-only in the Standard composer", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const onAgentInputChange = vi.fn();

    const { container } = render(
      <PromptStep
        {...baseProps}
        agentAttachmentDropTarget="input"
        onAgentAttachmentDrop={onAgentAttachmentDrop}
        onAgentAttachmentDragLeave={onAgentAttachmentDragLeave}
        onAgentInputChange={onAgentInputChange}
      />
    );

    const inputShell = container.querySelector(".agent-composer-input-shell");
    expect(inputShell).toBeTruthy();

    fireEvent.drop(inputShell as Element, {
      dataTransfer: {
        files: [new File(["ghost"], "ghost.png", { type: "image/png" })],
        types: ["Files", "text/plain", "text/prompt"],
        getData: (key: string) => {
          if (key === "text/plain") return "Dropped prompt text";
          if (key === "text/prompt") return "Dropped prompt text";
          return "";
        },
      },
    });

    expect(onAgentInputChange).toHaveBeenCalledWith("Dropped prompt text");
    expect(onAgentAttachmentDragLeave).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
  });

  it("does not load video reference prompts into the Standard composer input", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const onAgentInputChange = vi.fn();

    const { container } = render(
      <PromptStep
        {...baseProps}
        agentAttachmentDropTarget="input"
        onAgentAttachmentDrop={onAgentAttachmentDrop}
        onAgentAttachmentDragLeave={onAgentAttachmentDragLeave}
        onAgentInputChange={onAgentInputChange}
      />
    );

    const inputShell = container.querySelector(".agent-composer-input-shell");
    expect(inputShell).toBeTruthy();

    fireEvent.drop(inputShell as Element, {
      dataTransfer: {
        types: ["text/plain", "text/reference-url"],
        getData: (key: string) =>
          key === "text/plain"
            ? "Dropped video prompt"
            : key === "text/reference-url"
              ? "https://example.com/generated-video.mp4"
              : "",
      },
    });

    expect(onAgentInputChange).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragLeave).not.toHaveBeenCalled();
    expect(onAgentAttachmentDrop).toHaveBeenCalledTimes(1);
  });

  it("does not load video reference prompts into the Pulse composer input", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const onAgentInputChange = vi.fn();

    const { container } = render(
      <PulsePromptStep
        stepNumber="1"
        prompt=""
        onPromptChange={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        chatOnly
        agentEnabled
        agentAttachmentDropTarget="input"
        onAgentAttachmentDrop={onAgentAttachmentDrop}
        onAgentAttachmentDragLeave={onAgentAttachmentDragLeave}
        onAgentInputChange={onAgentInputChange}
      />
    );

    const inputShell = container.querySelector(".agent-composer-input-shell");
    expect(inputShell).toBeTruthy();

    fireEvent.drop(inputShell as Element, {
      dataTransfer: {
        types: ["text/plain", "text/reference-url"],
        getData: (key: string) =>
          key === "text/plain"
            ? "Dropped video prompt"
            : key === "text/reference-url"
              ? "https://example.com/generated-video.mp4"
              : "",
      },
    });

    expect(onAgentInputChange).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragLeave).not.toHaveBeenCalled();
    expect(onAgentAttachmentDrop).toHaveBeenCalledTimes(1);
  });

  it("restores composer focus after the agent response completes", async () => {
    const onAgentSend = vi.fn();
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    try {
      const { rerender } = render(
        <PromptStep {...baseProps} agentInput="keep going" onAgentSend={onAgentSend} />
      );

      const composerInput = screen.getByRole("textbox");
      fireEvent.focus(composerInput);
      fireEvent.keyDown(composerInput, { key: "Enter" });

      expect(onAgentSend).toHaveBeenCalledTimes(1);

      rerender(
        <PromptStep {...baseProps} agentInput="" onAgentSend={onAgentSend} agentIsSending />
      );
      rerender(<PromptStep {...baseProps} agentInput="" onAgentSend={onAgentSend} />);

      await waitFor(() => {
        expect(composerInput).toHaveFocus();
      });
    } finally {
      requestAnimationFrameSpy.mockRestore();
    }
  });

  it("does not restore composer focus after the user clicks away during an agent response", async () => {
    const onAgentSend = vi.fn();
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    try {
      const renderPromptStep = (agentIsSending = false) => (
        <>
          <button type="button">Outside action</button>
          <PromptStep
            {...baseProps}
            agentInput={agentIsSending ? "" : "keep going"}
            onAgentSend={onAgentSend}
            agentIsSending={agentIsSending}
          />
        </>
      );
      const { rerender } = render(renderPromptStep());

      const composerInput = screen.getByRole("textbox");
      fireEvent.focus(composerInput);
      fireEvent.keyDown(composerInput, { key: "Enter" });

      expect(onAgentSend).toHaveBeenCalledTimes(1);

      rerender(renderPromptStep(true));
      const outsideAction = screen.getByRole("button", { name: "Outside action" });
      fireEvent.mouseDown(outsideAction);
      act(() => {
        outsideAction.focus();
      });
      rerender(renderPromptStep(false));

      await waitFor(() => {
        expect(composerInput).not.toHaveFocus();
      });
    } finally {
      requestAnimationFrameSpy.mockRestore();
    }
  });

  it("restores composer focus when focus drifts during send without user click-away intent", async () => {
    const onAgentSend = vi.fn();
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    try {
      const renderPromptStep = (agentIsSending = false) => (
        <>
          <button type="button">Outside action</button>
          <PromptStep
            {...baseProps}
            agentInput={agentIsSending ? "" : "keep going"}
            onAgentSend={onAgentSend}
            agentIsSending={agentIsSending}
          />
        </>
      );
      const { rerender } = render(renderPromptStep());

      const composerInput = screen.getByRole("textbox");
      fireEvent.focus(composerInput);
      fireEvent.keyDown(composerInput, { key: "Enter" });

      expect(onAgentSend).toHaveBeenCalledTimes(1);

      rerender(renderPromptStep(true));
      const outsideAction = screen.getByRole("button", { name: "Outside action" });
      act(() => {
        outsideAction.focus();
      });
      rerender(renderPromptStep(false));

      await waitFor(() => {
        expect(composerInput).toHaveFocus();
      });
    } finally {
      requestAnimationFrameSpy.mockRestore();
    }
  });

  it("keeps the Standard composer enabled for typing while a send is in flight", () => {
    const onAgentInputChange = vi.fn();

    render(
      <PromptStep
        {...baseProps}
        agentInput="draft in progress"
        onAgentInputChange={onAgentInputChange}
        agentIsSending
      />
    );

    const composerInput = screen.getByRole("textbox");
    expect(composerInput).not.toBeDisabled();

    fireEvent.change(composerInput, { target: { value: "draft while thinking" } });
    expect(onAgentInputChange).toHaveBeenCalledWith("draft while thinking");
  });

  it("keeps image drops routed through the attachment pipeline in input-drop mode", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentInputChange = vi.fn();

    const { container } = render(
      <PromptStep
        {...baseProps}
        agentAttachmentDropTarget="input"
        onAgentAttachmentDrop={onAgentAttachmentDrop}
        onAgentInputChange={onAgentInputChange}
      />
    );

    const inputShell = container.querySelector(".agent-composer-input-shell");
    expect(inputShell).toBeTruthy();

    fireEvent.drop(inputShell as Element, {
      dataTransfer: {
        types: ["text/reference-url", "text/plain"],
        getData: (key: string) => {
          if (key === "text/reference-url") return "https://example.com/reference.png";
          if (key === "text/plain") return "Image note";
          return "";
        },
      },
    });

    expect(onAgentAttachmentDrop).toHaveBeenCalledTimes(1);
    expect(onAgentInputChange).not.toHaveBeenCalled();
  });

  it("blocks image drops and hides staged attachments when Standard Chat Mode is off", () => {
    const onAgentAttachmentDrop = vi.fn();

    const { container } = render(
      <PromptStep
        {...baseProps}
        chatModeEnabled={false}
        agentAttachmentDropTarget="input"
        onAgentAttachmentDrop={onAgentAttachmentDrop}
        stagedAttachments={[
          {
            id: "attachment-1",
            kind: "image",
            imageUrl: "https://example.com/reference.png",
            deliveryStatus: "ready",
          },
        ]}
      />
    );

    const inputShell = container.querySelector(".agent-composer-input-shell");
    expect(inputShell).toBeTruthy();
    const dropEvent = new MouseEvent("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        types: ["text/reference-url", "text/plain"],
        getData: (key: string) =>
          key === "text/reference-url"
            ? "https://example.com/reference.png"
            : key === "text/plain"
              ? "Image note"
              : "",
      },
    });
    fireEvent(inputShell as Element, dropEvent);

    expect(dropEvent.defaultPrevented).toBe(true);
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
    expect(container.querySelector(".agent-attachment-card")).toBeNull();
  });

  it("falls back to alternate attachment preview URLs when the first image fails", async () => {
    const { container, rerender } = render(
      <PromptStep
        {...baseProps}
        agentAttachmentDropTarget="input"
        stagedAttachments={[
          {
            id: "attachment-1",
            kind: "image",
            imageUrl: "https://cdn.example.com/stale-preview.png",
            imageFallbackUrls: ["https://cdn.example.com/signed-preview.png"],
            referenceId: "out-1",
          },
        ]}
      />
    );

    const image = container.querySelector(
      ".agent-attachment-card-media"
    ) as HTMLImageElement | null;
    expect(image?.getAttribute("src")).toBe("https://cdn.example.com/stale-preview.png");

    fireEvent.error(image as HTMLImageElement);

    await waitFor(() => {
      expect(image?.getAttribute("src")).toBe("https://cdn.example.com/signed-preview.png");
    });

    rerender(
      <PromptStep
        {...baseProps}
        agentAttachmentDropTarget="input"
        stagedAttachments={[
          {
            id: "attachment-1",
            kind: "image",
            imageUrl: "https://cdn.example.com/stale-preview.png",
            imageFallbackUrls: ["https://cdn.example.com/signed-preview.png"],
            referenceId: "out-1",
          },
        ]}
      />
    );

    await waitFor(() => {
      expect(image?.getAttribute("src")).toBe("https://cdn.example.com/signed-preview.png");
    });
  });

  it("renders thinking as a history row below the latest chat bubble", () => {
    const { container } = render(
      <PromptStep
        {...baseProps}
        agentMessages={[{ id: "u-1", role: "user", content: "a woman" }]}
        agentIsSending
      />
    );

    expect(
      container.querySelector(".agent-messages .agent-message.agent-thinking-message")
    ).toBeTruthy();
    expect(container.querySelector(".agent-thinking--composer-row")).toBeNull();
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
  });

  it("renders the Standard online-research label in the history thinking row", () => {
    const { container } = render(
      <PromptStep
        {...baseProps}
        agentMessages={[{ id: "u-1", role: "user", content: "research CDANCE lengths" }]}
        agentIsSending
        agentThinkingLabel="Researching online…"
      />
    );

    expect(
      container.querySelector(".agent-messages .agent-message.agent-thinking-message")
    ).toBeTruthy();
    expect(screen.getByText("Researching online…")).toBeInTheDocument();
    expect(screen.queryByText("Thinking…")).toBeNull();
  });

  it("keeps generation-driven history thinking enabled by default for non-create consumers", () => {
    const { container } = render(
      <PromptStep
        {...baseProps}
        agentMessages={[{ id: "u-1", role: "user", content: "a woman" }]}
        isGenerating
      />
    );

    expect(
      container.querySelector(".agent-messages .agent-message.agent-thinking-message")
    ).toBeTruthy();
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
  });

  it("does not render history thinking from generation state when chat thinking is agent-only", () => {
    const { container } = render(
      <PromptStep
        {...baseProps}
        agentMessages={[{ id: "u-1", role: "user", content: "a woman" }]}
        isGenerating
        showGenerationThinkingInChat={false}
      />
    );

    expect(
      container.querySelector(".agent-messages .agent-message.agent-thinking-message")
    ).toBeNull();
    expect(screen.queryByText("Thinking…")).toBeNull();
  });

  it("does not trigger hidden enhance shortcuts from Enter or Cmd+Enter", () => {
    const onAgentEnhanceSend = vi.fn();
    render(
      <PromptStep
        stepNumber={1}
        prompt="video prompt"
        onPromptChange={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        promptOnly
        enhanceOnly
        hideEnhanceButton
        onAgentEnhanceSend={onAgentEnhanceSend}
      />
    );

    const composer = screen.getByPlaceholderText("Describe what you want, then refine it.");
    fireEvent.keyDown(composer, { key: "Enter" });
    fireEvent.keyDown(composer, { key: "Enter", metaKey: true });

    expect(onAgentEnhanceSend).not.toHaveBeenCalled();
  });

  it("disables enhance affordances while agent bootstrap is pending", () => {
    render(
      <PromptStep
        stepNumber={1}
        prompt="video prompt"
        onPromptChange={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        promptOnly
        enhanceOnly
        agentBootstrapPending
        onAgentEnhanceSend={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Enhance prompt" })).toBeDisabled();
  });
});
