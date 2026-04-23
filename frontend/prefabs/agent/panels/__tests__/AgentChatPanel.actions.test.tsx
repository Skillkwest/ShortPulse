/**
 * AgentChatPanel action parity tests.
 * Ensures expanded chat can expose prompt ownership status and action chips.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("renders primary prompt status when enabled", () => {
    render(
      <AgentChatPanel
        messages={[]}
        input=""
        showPromptActions
        primaryPrompt="cinematic neon city alley at night"
        primarySource="agent"
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByText("Primary generation prompt")).toBeInTheDocument();
    expect(screen.getByText("Agent output")).toBeInTheDocument();
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
    expect(
      generateButtons.every((button) =>
        button.classList.contains("agent-response-inline-generate-prefab")
      )
    ).toBe(true);
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

  it("shows the guardrail reason above disabled output generate pills", () => {
    const message = "Select a model before generating.";

    render(
      <AgentChatPanel
        messages={[{ id: "a-1", role: "assistant", content: "Assistant output one." }]}
        input=""
        stagedPrompt="Assistant staged prompt."
        disableOutputGenerate
        outputGenerateGuardrailReason={message}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("hides inline history generate controls when the chat panel is configured to suppress them", () => {
    render(
      <AgentChatPanel
        messages={[{ id: "a-1", role: "assistant", content: "Assistant output one." }]}
        input=""
        stagedPrompt="Assistant staged prompt."
        hideOutputGenerateControls
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Generate from this agent output" })).toBeNull();
    expect(screen.queryByText("Assistant staged prompt.")).toBeInTheDocument();
    expect(screen.queryByText("Assistant output one.")).toBeInTheDocument();
  });

  it("keeps assistant bubble media visible when inline history generate controls are suppressed", () => {
    render(
      <AgentChatPanel
        messages={[{ id: "a-ready", role: "assistant", content: "Ready output." }]}
        input=""
        hideOutputGenerateControls
        assistantBubbleMedia={{
          "a-ready": {
            outputId: "out-ready",
            thumbnailUrl: "https://example.com/ready.png",
            state: "ready",
          },
        }}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Generate from this agent output" })).toBeNull();
    expect(screen.getByAltText("Generated output preview")).toBeInTheDocument();
  });

  it("renders linked bubble thumbnails and status states without breaking generate controls", () => {
    render(
      <AgentChatPanel
        messages={[
          { id: "a-ready", role: "assistant", content: "Ready output." },
          { id: "a-pending", role: "assistant", content: "Pending output." },
          { id: "a-failed", role: "assistant", content: "Failed output." },
        ]}
        input=""
        assistantBubbleMedia={{
          "a-ready": {
            outputId: "out-ready",
            thumbnailUrl: "https://example.com/ready.png",
            state: "ready",
          },
          "a-pending": {
            outputId: "out-pending",
            thumbnailUrl: null,
            state: "pending",
          },
          "a-failed": {
            outputId: "out-failed",
            thumbnailUrl: null,
            state: "failed",
          },
        }}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByAltText("Generated output preview")).toBeInTheDocument();
    expect(screen.getByText("Generating preview…")).toBeInTheDocument();
    expect(screen.getByText("Generation failed")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Generate from this agent output" })).toHaveLength(
      3
    );
  });

  it("supports assistant bubble inline edit with commit and cancel paths", () => {
    const onAssistantMessageEdit = vi.fn(() => true);
    render(
      <AgentChatPanel
        messages={[
          { id: "a-1", role: "assistant", content: "Assistant output one." },
          { id: "u-1", role: "user", content: "User input one." },
        ]}
        input=""
        showInput={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onAssistantMessageEdit={onAssistantMessageEdit}
      />
    );

    fireEvent.doubleClick(screen.getByText("Assistant output one."));
    const editor = screen.getByLabelText("Edit assistant message");
    const editingMessage = editor.closest(".agent-message") as HTMLElement;
    expect(editingMessage.getAttribute("draggable")).toBe("false");
    fireEvent.change(editor, { target: { value: "Edited assistant output." } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(onAssistantMessageEdit).toHaveBeenCalledWith({
      messageId: "a-1",
      content: "Edited assistant output.",
    });
    expect(screen.queryByLabelText("Edit assistant message")).not.toBeInTheDocument();

    fireEvent.doubleClick(screen.getByText("Assistant output one."));
    const secondEditor = screen.getByLabelText("Edit assistant message");
    fireEvent.change(secondEditor, { target: { value: "Should not persist" } });
    fireEvent.keyDown(secondEditor, { key: "Escape" });

    expect(onAssistantMessageEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Edit assistant message")).not.toBeInTheDocument();
  });

  it("keeps inline edit open when commit callback returns false", () => {
    const onAssistantMessageEdit = vi.fn(() => false);
    render(
      <AgentChatPanel
        messages={[{ id: "a-1", role: "assistant", content: "Assistant output one." }]}
        input=""
        showInput={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onAssistantMessageEdit={onAssistantMessageEdit}
      />
    );

    fireEvent.doubleClick(screen.getByText("Assistant output one."));
    const editor = screen.getByLabelText("Edit assistant message");
    fireEvent.change(editor, { target: { value: "Edited assistant output." } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(onAssistantMessageEdit).toHaveBeenCalledWith({
      messageId: "a-1",
      content: "Edited assistant output.",
    });
    expect(screen.getByLabelText("Edit assistant message")).toBeInTheDocument();
  });

  it("does not enter edit mode when assistant edit callback is not provided", () => {
    render(
      <AgentChatPanel
        messages={[{ id: "a-1", role: "assistant", content: "Assistant output one." }]}
        input=""
        showInput={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    fireEvent.doubleClick(screen.getByText("Assistant output one."));
    expect(screen.queryByLabelText("Edit assistant message")).not.toBeInTheDocument();
  });

  it("mirrors rendered assistant text styling and fixed dimensions in edit mode", () => {
    render(
      <AgentChatPanel
        messages={[{ id: "a-1", role: "assistant", content: "Assistant output one." }]}
        input=""
        showInput={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onAssistantMessageEdit={vi.fn(() => true)}
      />
    );

    const assistantText = screen.getByText("Assistant output one.");
    const getRect = vi.spyOn(assistantText, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 318,
      height: 146,
      top: 0,
      right: 318,
      bottom: 146,
      left: 0,
      toJSON: () => ({}),
    });
    const nativeGetComputedStyle = window.getComputedStyle;
    const getComputedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element: Element, pseudoElt?: string | null) => {
        if (element === assistantText) {
          return {
            fontFamily: '"Sora", sans-serif',
            fontSize: "14px",
            fontWeight: "600",
            lineHeight: "1.6",
            letterSpacing: "0.02em",
            color: "rgb(37, 169, 191)",
          } as CSSStyleDeclaration;
        }
        return nativeGetComputedStyle(element, pseudoElt);
      });

    fireEvent.doubleClick(assistantText);
    const editor = screen.getByLabelText("Edit assistant message") as HTMLTextAreaElement;
    expect(editor.style.width).toBe("318px");
    expect(editor.style.height).toBe("146px");
    expect(editor.style.minHeight).toBe("146px");
    expect(editor.style.maxHeight).toBe("146px");
    expect(editor.style.fontFamily).toBe('"Sora", sans-serif');
    expect(editor.style.fontSize).toBe("14px");
    expect(editor.style.fontWeight).toBe("600");
    expect(editor.style.lineHeight).toBe("1.6");
    expect(editor.style.letterSpacing).toBe("0.02em");
    expect(editor.style.color).toBe("rgb(37, 169, 191)");
    expect(editor.style.resize).toBe("none");

    getRect.mockRestore();
    getComputedStyleSpy.mockRestore();
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

  it("keeps assistant bubble draggable from text area when output preview media exists", () => {
    render(
      <AgentChatPanel
        messages={[{ id: "a-1", role: "assistant", content: "Assistant output one." }]}
        input=""
        assistantBubbleMedia={{
          "a-1": {
            outputId: "out-ready",
            thumbnailUrl: "https://example.com/ready.png",
            state: "ready",
          },
        }}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    const messageText = screen.getByText("Assistant output one.");
    const draggableMessage = messageText.closest(".agent-message") as HTMLElement;
    expect(draggableMessage).toBeTruthy();

    const setData = vi.fn();
    const setDragImage = vi.fn();
    const dataTransfer = {
      setData,
      setDragImage,
      effectAllowed: "none",
    } as unknown as DataTransfer;

    fireEvent.dragStart(messageText, { dataTransfer });
    expect(setData).toHaveBeenCalledWith("text/prompt", "Assistant output one.");
    expect(draggableMessage.classList.contains("is-dragging")).toBe(true);

    fireEvent.dragEnd(draggableMessage);
    expect(draggableMessage.classList.contains("is-dragging")).toBe(false);
  });

  it("blocks drag start from inline output preview media", () => {
    render(
      <AgentChatPanel
        messages={[{ id: "a-1", role: "assistant", content: "Assistant output one." }]}
        input=""
        assistantBubbleMedia={{
          "a-1": {
            outputId: "out-ready",
            thumbnailUrl: "https://example.com/ready.png",
            state: "ready",
          },
        }}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    const previewImage = screen.getByAltText("Generated output preview");
    const draggableMessage = previewImage.closest(".agent-message") as HTMLElement;
    expect(draggableMessage).toBeTruthy();

    const setData = vi.fn();
    const setDragImage = vi.fn();
    const dataTransfer = {
      setData,
      setDragImage,
      effectAllowed: "none",
    } as unknown as DataTransfer;

    fireEvent.dragStart(previewImage, { dataTransfer });

    expect(setData).not.toHaveBeenCalled();
    expect(setDragImage).not.toHaveBeenCalled();
    expect(document.querySelector(".agent-message-drag-ghost")).toBeNull();
    expect(draggableMessage.classList.contains("is-dragging")).toBe(false);
  });

  it("omits inline output preview controls from drag ghosts", () => {
    render(
      <AgentChatPanel
        messages={[{ id: "a-1", role: "assistant", content: "Assistant output one." }]}
        input=""
        assistantBubbleMedia={{
          "a-1": {
            outputId: "out-pending",
            thumbnailUrl: null,
            state: "pending",
          },
        }}
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

    const ghost = document.querySelector(".agent-message-drag-ghost") as HTMLElement | null;
    expect(ghost).toBeTruthy();
    expect(ghost?.querySelector(".agent-output-bubble-controls")).toBeNull();
    if (ghost) {
      expect(within(ghost).queryByText("Generating preview…")).toBeNull();
    }

    fireEvent.dragEnd(draggableMessage);
    expect(document.querySelector(".agent-message-drag-ghost")).toBeNull();
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
