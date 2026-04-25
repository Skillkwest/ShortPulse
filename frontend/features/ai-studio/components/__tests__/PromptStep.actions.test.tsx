/**
 * PromptStep action-surface tests.
 * Verifies structured agent actions are rendered and routed to callbacks.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromptStep } from "../PromptStep";

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

  it("uses direct OpenAI copy when the bypass lane is active", () => {
    render(<PromptStep {...baseProps} directOpenAiBypassEnabled />);

    expect(screen.queryByText("Agent Assist")).toBeNull();
    expect(screen.getByPlaceholderText("Ask ShortPulse or write your prompt")).toBeInTheDocument();
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

  it("keeps inline chat visible in chat-only mode when expanded chat state is true", () => {
    render(<PromptStep {...baseProps} agentChatOpen />);

    expect(screen.getByPlaceholderText("Message the agent...")).toBeInTheDocument();
  });

  it("routes attachment drop handlers to the input shell when configured", () => {
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
    expect(chatSurface).toBeTruthy();
    expect(inputShell).toBeTruthy();

    fireEvent.dragEnter(chatSurface as Element);
    fireEvent.dragOver(chatSurface as Element);
    fireEvent.dragLeave(chatSurface as Element);
    fireEvent.drop(chatSurface as Element);
    expect(onAgentAttachmentDragEnter).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragOver).not.toHaveBeenCalled();
    expect(onAgentAttachmentDragLeave).not.toHaveBeenCalled();
    expect(onAgentAttachmentDrop).not.toHaveBeenCalled();

    fireEvent.dragEnter(inputShell as Element);
    fireEvent.dragOver(inputShell as Element);
    fireEvent.dragLeave(inputShell as Element);
    fireEvent.drop(inputShell as Element);
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
});
