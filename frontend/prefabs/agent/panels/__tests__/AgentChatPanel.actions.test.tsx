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
          questions: ["Should this be rainy?"],
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
    expect(screen.getByRole("button", { name: "Should this be rainy?" })).toBeInTheDocument();
  });

  it("routes action clicks to callbacks", () => {
    const onSelectVariation = vi.fn();
    const onUseQuestion = vi.fn();
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
          questions: ["Should this be rainy?"],
          describeTargets: ["ref-a", "ref-b"],
        }}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onAgentSelectVariation={onSelectVariation}
        onAgentUseQuestion={onUseQuestion}
        onAgentDescribeTargets={onDescribeTargets}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "close-up framing" }));
    expect(onSelectVariation).toHaveBeenCalledWith("close-up framing");

    fireEvent.click(screen.getByRole("button", { name: "Should this be rainy?" }));
    expect(onUseQuestion).toHaveBeenCalledWith("Should this be rainy?");

    fireEvent.click(screen.getByRole("button", { name: "Describe refs (2)" }));
    expect(onDescribeTargets).toHaveBeenCalledWith(["ref-a", "ref-b"]);
  });

  it("shows small generate pills on assistant outputs and does not trigger bubble click", () => {
    const onMessageClick = vi.fn();
    render(
      <AgentChatPanel
        messages={[
          { id: "a-1", role: "assistant", content: "Assistant output one." },
          { id: "u-1", role: "user", content: "User input one." },
        ]}
        input=""
        stagedPrompt="Assistant staged prompt."
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onMessageClick={onMessageClick}
      />
    );

    const generateButtons = screen.getAllByRole("button", {
      name: "Generate from this agent output",
    });
    expect(generateButtons).toHaveLength(2);
    fireEvent.click(generateButtons[0]);
    expect(onMessageClick).not.toHaveBeenCalled();
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
    const dataTransfer = {
      setData,
      effectAllowed: "none",
    } as unknown as DataTransfer;

    fireEvent.dragStart(draggableMessage, { dataTransfer });
    expect(setData).toHaveBeenCalledWith("text/plain", "Assistant output one.");
    expect(setData).toHaveBeenCalledWith("text/prompt", "Assistant output one.");
    expect(draggableMessage.classList.contains("is-dragging")).toBe(true);

    fireEvent.dragEnd(draggableMessage);
    expect(draggableMessage.classList.contains("is-dragging")).toBe(false);
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
