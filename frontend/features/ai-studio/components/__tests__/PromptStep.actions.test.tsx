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
  onSavePrompt: vi.fn(),
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
  it("disables pin prompt in chat mode when composer input is empty", () => {
    render(<PromptStep {...baseProps} agentInput="" />);

    expect(screen.getByRole("button", { name: "Pin prompt" })).toBeDisabled();
  });

  it("shows a pin prompt button in chat mode and routes clicks to save", () => {
    const onSavePrompt = vi.fn();

    render(<PromptStep {...baseProps} agentInput="a dog in a park" onSavePrompt={onSavePrompt} />);

    fireEvent.click(screen.getByRole("button", { name: "Pin prompt" }));
    expect(onSavePrompt).toHaveBeenCalledWith("a dog in a park");
  });

  it("routes chat-off composer edits and pin actions through the authored prompt lane", () => {
    const onPromptChange = vi.fn();
    const onAgentInputChange = vi.fn();
    const onSavePrompt = vi.fn();

    render(
      <PromptStep
        {...baseProps}
        prompt="persisted standard prompt"
        agentInput="transient chat input"
        chatModeEnabled={false}
        onPromptChange={onPromptChange}
        onAgentInputChange={onAgentInputChange}
        onSavePrompt={onSavePrompt}
      />
    );

    const composer = screen.getByPlaceholderText("Write your prompt...");
    fireEvent.change(composer, { target: { value: "Updated authored prompt" } });

    expect(onPromptChange).toHaveBeenCalledWith("Updated authored prompt");
    expect(onAgentInputChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Pin prompt" }));
    expect(onSavePrompt).toHaveBeenCalledWith("persisted standard prompt");
  });

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

    const composer = screen.getByPlaceholderText("Write your prompt...");
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(onAgentSend).not.toHaveBeenCalled();

    expect(screen.queryByRole("button", { name: "Send to agent" })).toBeNull();
    expect(
      screen.queryByText("Chat Mode is off. Generate uses your text exactly; agent rewrite is off.")
    ).toBeNull();
  });

  it("disables send affordances while agent bootstrap is pending", () => {
    render(<PromptStep {...baseProps} agentBootstrapPending />);

    expect(screen.getByRole("button", { name: "Send to agent" })).toBeDisabled();
  });

  it("shows inline generate in chat-off mode and routes clicks", () => {
    const onInlineGenerate = vi.fn();
    render(
      <PromptStep
        {...baseProps}
        chatModeEnabled={false}
        agentInput="a clear product prompt"
        chatModeInlineGenerate={{ onGenerate: onInlineGenerate }}
      />
    );

    const generateButton = screen.getByRole("button", { name: "Generate with current prompt" });
    expect(generateButton).not.toHaveClass("agent-response-inline-generate-prefab");
    fireEvent.click(generateButton);
    expect(onInlineGenerate).toHaveBeenCalledTimes(1);
  });

  it("renders prefab-backed inline generate when variant flag is enabled", () => {
    const onInlineGenerate = vi.fn();
    render(
      <PromptStep
        {...baseProps}
        chatModeEnabled={false}
        agentInput="a clear product prompt"
        chatModeInlineGenerate={{ onGenerate: onInlineGenerate }}
        useAgentResponseInlineGeneratePrefab
      />
    );

    const generateButton = screen.getByRole("button", { name: "Generate with current prompt" });
    expect(generateButton).toHaveClass("agent-response-inline-generate-prefab");
    fireEvent.click(generateButton);
    expect(onInlineGenerate).toHaveBeenCalledTimes(1);
  });

  it("hides inline generate while chat mode is enabled", () => {
    const onInlineGenerate = vi.fn();
    render(<PromptStep {...baseProps} chatModeInlineGenerate={{ onGenerate: onInlineGenerate }} />);

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

  it("disables inline generate in chat-off mode when input is empty", () => {
    render(
      <PromptStep
        {...baseProps}
        prompt=""
        chatModeEnabled={false}
        agentInput=""
        chatModeInlineGenerate={{ onGenerate: vi.fn() }}
      />
    );

    expect(screen.getByRole("button", { name: "Generate with current prompt" })).toBeDisabled();
  });

  it("keeps inline generate enabled in chat-off mode when the shared prompt can be used", () => {
    render(
      <PromptStep
        {...baseProps}
        prompt="shared fallback prompt"
        chatModeEnabled={false}
        agentInput=""
        chatModeInlineGenerate={{ onGenerate: vi.fn() }}
      />
    );

    expect(screen.getByRole("button", { name: "Generate with current prompt" })).toBeEnabled();
  });

  it("shows a generic disabled reason for chat-off inline generate when provided", () => {
    render(
      <PromptStep
        {...baseProps}
        chatModeEnabled={false}
        agentInput="a clear product prompt"
        chatModeInlineGenerate={{ onGenerate: vi.fn() }}
        disableOutputGenerate
        outputGenerateGuardrailReason="Select a model before generating."
      />
    );

    expect(screen.getAllByText("Select a model before generating.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Generate with current prompt" })).toBeDisabled();
  });

  it("keeps inline chat visible in chat-only mode", () => {
    render(<PromptStep {...baseProps} />);

    expect(screen.getByPlaceholderText("Message the agent...")).toBeInTheDocument();
  });

  it("routes attachment drop handlers across the visible input-mode composer surface", () => {
    const onAgentAttachmentDrop = vi.fn();
    const onAgentAttachmentDragOver = vi.fn();
    const onAgentAttachmentDragEnter = vi.fn();
    const onAgentAttachmentDragLeave = vi.fn();
    const { container } = render(
      <PromptStep
        {...baseProps}
        agentAttachmentDropTarget="input"
        onAgentAttachmentDrop={onAgentAttachmentDrop}
        onAgentAttachmentDragOver={onAgentAttachmentDragOver}
        onAgentAttachmentDragEnter={onAgentAttachmentDragEnter}
        onAgentAttachmentDragLeave={onAgentAttachmentDragLeave}
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
    fireEvent.drop(chatSurface as Element);
    expect(onAgentAttachmentDragEnter).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragOver).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragLeave).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDrop).toHaveBeenCalledTimes(1);

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
    fireEvent.drop(promptStep as Element);
    expect(onAgentAttachmentDragEnter).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragOver).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragLeave).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDrop).toHaveBeenCalledTimes(1);
  });

  it("routes Pulse attachment drops across the visible input-mode composer surface", () => {
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
        onAgentAttachmentDrop={onAgentAttachmentDrop}
        onAgentAttachmentDragOver={onAgentAttachmentDragOver}
        onAgentAttachmentDragEnter={onAgentAttachmentDragEnter}
        onAgentAttachmentDragLeave={onAgentAttachmentDragLeave}
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
    fireEvent.drop(chatSurface as Element);
    expect(onAgentAttachmentDragEnter).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragOver).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragLeave).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDrop).toHaveBeenCalledTimes(1);

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
    fireEvent.drop(promptStep as Element);
    expect(onAgentAttachmentDragEnter).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragOver).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDragLeave).toHaveBeenCalledTimes(1);
    expect(onAgentAttachmentDrop).toHaveBeenCalledTimes(1);
  });

  it("focuses the composer after a prompt-text drop into the input shell", () => {
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
          agentAttachmentDropTarget="input"
          onAgentAttachmentDrop={onAgentAttachmentDrop}
          onAgentAttachmentDragLeave={onAgentAttachmentDragLeave}
          onAgentInputChange={onAgentInputChange}
        />
      );

      const inputShell = container.querySelector(".agent-composer-input-shell");
      const composerInput = screen.getByRole("textbox");
      expect(inputShell).toBeTruthy();

      fireEvent.drop(inputShell as Element, {
        dataTransfer: {
          types: ["text/plain"],
          getData: (key: string) => (key === "text/plain" ? "Dropped prompt text" : ""),
        },
      });

      expect(onAgentAttachmentDrop).not.toHaveBeenCalled();
      expect(onAgentAttachmentDragLeave).toHaveBeenCalledTimes(1);
      expect(onAgentInputChange).toHaveBeenCalledWith("Dropped prompt text");
      expect(composerInput).toHaveFocus();
    } finally {
      requestAnimationFrameSpy.mockRestore();
    }
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

  it.skip("falls back to alternate attachment preview URLs when the first image fails", async () => {
    const { container } = render(
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
