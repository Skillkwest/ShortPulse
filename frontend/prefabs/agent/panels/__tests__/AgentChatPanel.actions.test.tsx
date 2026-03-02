/**
 * AgentChatPanel action parity tests.
 * Ensures expanded chat can expose prompt ownership status and action chips.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentChatPanel } from "../AgentChatPanel";

describe("AgentChatPanel prompt actions", () => {
  it("renders staged attachments as chat-side reference cards without metadata text", () => {
    render(
      <AgentChatPanel
        messages={[]}
        input=""
        stagedAttachments={[
          {
            id: "img-1",
            kind: "image",
            imageUrl: "https://example.com/ref.png",
            text: "Should stay hidden",
          },
          {
            id: "prompt-1",
            kind: "prompt",
            text: "Prompt snippet should stay hidden",
          },
        ]}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onRemoveAttachment={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Attached references")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove attachment" })).toHaveLength(2);
    expect(screen.queryByText("Image Ref")).not.toBeInTheDocument();
    expect(screen.queryByText("Text Ref")).not.toBeInTheDocument();
    expect(screen.queryByText("Should stay hidden")).not.toBeInTheDocument();
  });

  it("renders primary prompt status and action chips when enabled", () => {
    render(
      <AgentChatPanel
        messages={[]}
        input=""
        showPromptActions
        primaryPrompt="cinematic neon city alley at night"
        primarySource="agent"
        agentActions={{
          variations: ["close-up framing"],
          describeTargets: ["ref-a"],
        }}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByText("Primary generation prompt")).toBeInTheDocument();
    expect(screen.getByText("Agent output")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Describe refs (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "close-up framing" })).toBeInTheDocument();
  });

  it("routes action clicks to callbacks", () => {
    const onSelectVariation = vi.fn();
    const onDescribeTargets = vi.fn();

    render(
      <AgentChatPanel
        messages={[]}
        input=""
        showPromptActions
        primaryPrompt="cinematic neon city alley at night"
        primarySource="agent"
        agentActions={{
          variations: ["close-up framing"],
          describeTargets: ["ref-a", "ref-b"],
        }}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onAgentSelectVariation={onSelectVariation}
        onAgentDescribeTargets={onDescribeTargets}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "close-up framing" }));
    expect(onSelectVariation).toHaveBeenCalledWith("close-up framing");

    fireEvent.click(screen.getByRole("button", { name: "Describe refs (2)" }));
    expect(onDescribeTargets).toHaveBeenCalledWith(["ref-a", "ref-b"]);
  });

  it("forwards inline generate prompts and does not trigger bubble click", () => {
    const onMessageClick = vi.fn();
    const onGenerateOutputPrompt = vi.fn();
    render(
      <AgentChatPanel
        messages={[
          { id: "a-1", role: "assistant", content: "Assistant output one." },
          { id: "u-1", role: "user", content: "User input one." },
        ]}
        input=""
        stagedPrompt="Assistant staged prompt."
        outputGenerateCostCredits={35}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onMessageClick={onMessageClick}
        onGenerateOutputPrompt={onGenerateOutputPrompt}
      />
    );

    const generateButtons = screen.getAllByRole("button", {
      name: "Generate from this agent output",
    });
    expect(generateButtons).toHaveLength(2);
    expect(screen.getAllByText("35")).toHaveLength(2);
    fireEvent.click(generateButtons[0]);
    fireEvent.click(generateButtons[1]);
    expect(onGenerateOutputPrompt).toHaveBeenNthCalledWith(1, {
      messageId: "staged-agent-output",
      prompt: "Assistant staged prompt.",
      source: "staged",
    });
    expect(onGenerateOutputPrompt).toHaveBeenNthCalledWith(2, {
      messageId: "a-1",
      prompt: "Assistant output one.",
      source: "history",
    });
    expect(onMessageClick).not.toHaveBeenCalled();
  });

  it("disables small generate pills when output generate is disabled", () => {
    render(
      <AgentChatPanel
        messages={[{ id: "a-1", role: "assistant", content: "Assistant output one." }]}
        input=""
        stagedPrompt="Assistant staged prompt."
        disableOutputGenerate
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    const generateButtons = screen.getAllByRole("button", {
      name: "Generate from this agent output",
    });
    expect(generateButtons).toHaveLength(2);
    expect(generateButtons.every((button) => button.hasAttribute("disabled"))).toBe(true);
  });

  it("exposes prompt text on drag start for assistant and user bubbles", () => {
    render(
      <AgentChatPanel
        messages={[
          { id: "a-1", role: "assistant", content: "Assistant output one." },
          { id: "u-1", role: "user", content: "User input one." },
        ]}
        input=""
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    const draggableMessage = screen
      .getByText("Assistant output one.")
      .closest(".agent-message") as HTMLElement;
    expect(draggableMessage).toBeTruthy();

    const setData = vi.fn();
    const setDragImage = vi.fn();
    const dataTransfer = {
      setData,
      setDragImage,
      effectAllowed: "none",
    } as unknown as DataTransfer;

    fireEvent.dragStart(draggableMessage, { dataTransfer });
    expect(setData).toHaveBeenCalledWith("text/plain", "Assistant output one.");
    expect(setData).toHaveBeenCalledWith("text/prompt", "Assistant output one.");
    expect(setDragImage).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".agent-message-drag-ghost")).toHaveLength(1);
    expect(draggableMessage.classList.contains("is-dragging")).toBe(true);

    fireEvent.dragEnd(draggableMessage);
    expect(document.querySelectorAll(".agent-message-drag-ghost")).toHaveLength(0);
    expect(draggableMessage.classList.contains("is-dragging")).toBe(false);
  });

  it("renders thinking inside message history when placement is history", () => {
    const { container } = render(
      <AgentChatPanel
        messages={[{ id: "u-1", role: "user", content: "User input one." }]}
        input=""
        isSending
        showThinkingIndicator
        thinkingIndicatorPlacement="history"
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(
      container.querySelector(".agent-messages .agent-message.agent-thinking-message")
    ).toBeTruthy();
    expect(container.querySelector(".agent-chat-panel > .agent-thinking")).toBeNull();
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
  });

  it("shows a send spinner while the panel is sending", () => {
    const { container } = render(
      <AgentChatPanel
        messages={[]}
        input="draft"
        isSending
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toBeDisabled();
    expect(sendButton).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".agent-send-spinner")).toBeTruthy();
  });

  it("marks only the newest assistant message when latest-only highlighting is enabled", () => {
    const { container } = render(
      <AgentChatPanel
        messages={[
          { id: "a-1", role: "assistant", content: "First assistant output." },
          { id: "u-1", role: "user", content: "User reply." },
          { id: "a-2", role: "assistant", content: "Second assistant output." },
        ]}
        input=""
        highlightLatestAssistantOnly
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(
      container.querySelectorAll(".agent-message.agent-assistant.is-latest-assistant")
    ).toHaveLength(1);
    expect(
      container.querySelectorAll(".agent-message.agent-assistant.is-stale-assistant")
    ).toHaveLength(1);
  });
});
