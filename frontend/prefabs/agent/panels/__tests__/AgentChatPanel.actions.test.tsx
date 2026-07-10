/**
 * AgentChatPanel regression tests.
 * Ensures staged attachments and generate controls behave correctly.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulseCreateChatPanel } from "../../../../features/ai-studio/components/promptStep/PulseCreateChatPanel";
import { StandardCreateChatPanel } from "../../../../features/ai-studio/components/promptStep/StandardCreateChatPanel";
import { AgentChatPanel } from "../AgentChatPanel";

describe("AgentChatPanel prompt actions", () => {
  it("keeps Pulse presentation out of the shared chat prefab source", () => {
    const source = readFileSync(
      path.join(process.cwd(), "prefabs/agent/panels/AgentChatPanel.tsx"),
      "utf8"
    );

    expect(source).not.toContain("PulseGuidedMessageBody");
    expect(source).not.toContain("pulse_guided");
  });

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

  it("normalizes legacy image preview fields through the shared attachment renderer", () => {
    const { container } = render(
      <AgentChatPanel
        messages={[]}
        input=""
        stagedAttachments={[
          {
            id: "img-legacy-1",
            kind: "image",
            imageUrl: null,
            referenceRenderUrl: "https://example.com/legacy-preview.png",
            text: null,
          },
        ]}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    const preview = container.querySelector("img");
    expect(preview).toHaveAttribute("src", "https://example.com/legacy-preview.png");
  });

  it("forwards inline generate prompts and does not trigger bubble click", () => {
    const onMessageClick = vi.fn();
    const onGenerateOutputPrompt = vi.fn();
    render(
      <AgentChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
          },
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

  it("does not render assistant bubble action buttons when output generate is unavailable", () => {
    render(
      <AgentChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
          },
        ]}
        input=""
        stagedPrompt="Assistant staged prompt."
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Generate from this agent output" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Apply this agent output to the composer" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Use as prompt" })).toBeNull();
  });

  it("offers a subtle use-as-prompt action only for the latest assistant message when opted in", () => {
    const onUseAssistantMessageAsPrompt = vi.fn();

    render(
      <AgentChatPanel
        messages={[
          { id: "a-1", role: "assistant", content: "Earlier assistant output." },
          { id: "u-1", role: "user", content: "User input one." },
          {
            id: "a-2",
            role: "assistant",
            content: "Latest assistant output.",
            outputPrompt: "Latest prompt artifact.",
            canUseAsPrompt: true,
          },
        ]}
        input=""
        highlightLatestAssistantOnly
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onUseAssistantMessageAsPrompt={onUseAssistantMessageAsPrompt}
      />
    );

    const earlierMessage = screen
      .getByText("Earlier assistant output.")
      .closest(".agent-message") as HTMLElement;
    expect(within(earlierMessage).queryByRole("button", { name: "Use as prompt" })).toBeNull();

    const useAsPromptButton = screen.getByRole("button", { name: "Use as prompt" });
    fireEvent.click(useAsPromptButton);

    expect(onUseAssistantMessageAsPrompt).toHaveBeenCalledWith({
      messageId: "a-2",
      prompt: "Latest prompt artifact.",
    });
  });

  it("disables small generate pills when output generate is disabled", () => {
    const onGenerateOutputPrompt = vi.fn();
    render(
      <AgentChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
          },
        ]}
        input=""
        stagedPrompt="Assistant staged prompt."
        disableOutputGenerate
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onGenerateOutputPrompt={onGenerateOutputPrompt}
      />
    );

    const generateButtons = screen.getAllByRole("button", {
      name: "Generate from this agent output",
    });
    expect(generateButtons).toHaveLength(2);
    expect(generateButtons.every((button) => button.hasAttribute("disabled"))).toBe(true);
  });

  it("does not show a detached guardrail reason above disabled output generate pills", () => {
    const message = "Select a model before generating.";

    render(
      <AgentChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
          },
        ]}
        input=""
        stagedPrompt="Assistant staged prompt."
        disableOutputGenerate
        outputGenerateGuardrailReason={message}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.queryByText(message)).not.toBeInTheDocument();
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

  it("does not expose generate controls for non-prompt assistant messages", () => {
    const onGenerateOutputPrompt = vi.fn();
    const onAssistantMessageEdit = vi.fn(() => true);

    render(
      <AgentChatPanel
        messages={[
          {
            id: "upstream-error-1",
            role: "assistant",
            content: "I can't process that request right now. Please try again.",
            canUseAsPrompt: false,
            outcomeClass: "upstream_error",
          },
        ]}
        input=""
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onGenerateOutputPrompt={onGenerateOutputPrompt}
        onAssistantMessageEdit={onAssistantMessageEdit}
      />
    );

    expect(screen.queryByRole("button", { name: "Generate from this agent output" })).toBeNull();
    const message = screen.getByText("I can't process that request right now. Please try again.");
    const dragSurface = message.closest(".agent-message-prompt-drag-surface") as HTMLElement;
    expect(dragSurface).toBeNull();
    expect(message.closest(".agent-message")).not.toHaveClass("is-draggable");
    fireEvent.doubleClick(message);
    expect(onAssistantMessageEdit).not.toHaveBeenCalled();
    expect(onGenerateOutputPrompt).not.toHaveBeenCalled();
  });

  it.each(["refusal_safety", "refusal_model", "upstream_error", "route_error"] as const)(
    "does not expose reusable actions for %s messages with stale prompt metadata",
    (outcomeClass) => {
      const onGenerateOutputPrompt = vi.fn();
      const onUseAssistantMessageAsPrompt = vi.fn();
      const onAssistantMessageEdit = vi.fn(() => true);
      const content = `Terminal ${outcomeClass} message.`;

      render(
        <AgentChatPanel
          messages={[
            {
              id: `failure-${outcomeClass}`,
              role: "assistant",
              content,
              outputPrompt: "Stale prompt artifact that must not be reusable.",
              canUseAsPrompt: true,
              outcomeClass,
            },
          ]}
          input=""
          highlightLatestAssistantOnly
          onInputChange={vi.fn()}
          onSend={vi.fn()}
          onGenerateOutputPrompt={onGenerateOutputPrompt}
          onUseAssistantMessageAsPrompt={onUseAssistantMessageAsPrompt}
          onAssistantMessageEdit={onAssistantMessageEdit}
        />
      );

      expect(screen.queryByRole("button", { name: "Generate from this agent output" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Use as prompt" })).toBeNull();
      const message = screen.getByText(content);
      expect(message.closest(".agent-message-prompt-drag-surface")).toBeNull();
      expect(message.closest(".agent-message")).not.toHaveClass("is-draggable");
      fireEvent.doubleClick(message);
      expect(onAssistantMessageEdit).not.toHaveBeenCalled();
      expect(onGenerateOutputPrompt).not.toHaveBeenCalled();
      expect(onUseAssistantMessageAsPrompt).not.toHaveBeenCalled();
    }
  );

  it("keeps conversational assistant replies draggable as text without treating them as prompt output", () => {
    const onGenerateOutputPrompt = vi.fn();

    render(
      <AgentChatPanel
        messages={[
          {
            id: "legacy-1",
            role: "assistant",
            content: "Legacy assistant message without prompt metadata.",
          },
        ]}
        input=""
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onGenerateOutputPrompt={onGenerateOutputPrompt}
      />
    );

    const message = screen.getByText("Legacy assistant message without prompt metadata.");
    const messageBubble = message.closest(".agent-message") as HTMLElement;
    const dragSurface = message.closest(".agent-message-prompt-drag-surface") as HTMLElement;
    expect(messageBubble).toBeTruthy();
    expect(dragSurface).toBeTruthy();
    expect(messageBubble).not.toHaveClass("agent-message--with-output-generate");
    expect(messageBubble).not.toHaveClass("agent-message--prompt-output");
    expect(messageBubble).toHaveClass("is-draggable");
    expect(messageBubble.getAttribute("draggable")).toBe("false");
    expect(dragSurface).toHaveAttribute("draggable", "true");
    expect(screen.queryByRole("button", { name: "Generate from this agent output" })).toBeNull();

    const setData = vi.fn();
    const dataTransfer = {
      setData,
      effectAllowed: "none",
    } as unknown as DataTransfer;

    fireEvent.dragStart(dragSurface, { dataTransfer });
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      "Legacy assistant message without prompt metadata."
    );
    expect(setData).toHaveBeenCalledWith(
      "text/prompt",
      "Legacy assistant message without prompt metadata."
    );

    fireEvent.dragEnd(dragSurface);
    expect(messageBubble.classList.contains("is-dragging")).toBe(false);
    expect(onGenerateOutputPrompt).not.toHaveBeenCalled();
  });

  it("keeps successful message-only replies draggable and editable even without prompt metadata", () => {
    const onAssistantMessageEdit = vi.fn(() => true);
    render(
      <AgentChatPanel
        messages={[
          {
            id: "success-message-1",
            role: "assistant",
            content: "A concise successful chat reply.",
            canUseAsPrompt: false,
            outcomeClass: "success_message",
            decision: "allow",
          },
        ]}
        input=""
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onAssistantMessageEdit={onAssistantMessageEdit}
      />
    );

    const message = screen.getByText("A concise successful chat reply.");
    expect(message.closest(".agent-message-prompt-drag-surface")).toHaveAttribute(
      "draggable",
      "true"
    );
    fireEvent.doubleClick(message);
    const editor = screen.getByLabelText("Edit assistant message");
    fireEvent.change(editor, {
      target: { value: "Edited successful chat reply." },
    });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onAssistantMessageEdit).toHaveBeenCalled();
  });

  it("renders pulse-guided assistant replies without redundant step labels", () => {
    render(
      <PulseCreateChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content:
              "CURRENT STEP\n\nWhich camera motion should I use? Pick one from the list below.\n\n1) Static - Locked-off camera\n2) Pan - Rotates horizontally\n3) Dolly In - Moves camera closer\n\nReply with one option or type your own.",
          },
        ]}
        input=""
        showInput={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.queryByText("CURRENT STEP")).not.toBeInTheDocument();
    expect(
      screen.getByText("Which camera motion should I use? Pick one from the list below.")
    ).toBeInTheDocument();
    expect(screen.getByText("Reply with one option or type your own.")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.textContent)).toEqual([
      "Static - Locked-off camera",
      "Pan - Rotates horizontally",
      "Dolly In - Moves camera closer",
    ]);
  });

  it("renders standard assistant and user messages with richer readable structure", () => {
    const { container } = render(
      <StandardCreateChatPanel
        messages={[
          {
            id: "u-1",
            role: "user",
            content: "Project Notes:\n\n- Keep the tone hopeful\n- Focus on the reveal",
          },
          {
            id: "a-1",
            role: "assistant",
            content:
              "# Direction\n\nHere is the best next move.\n\n1. Lock the emotional tone\n2. Clarify the final reveal",
          },
        ]}
        input=""
        showInput={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByText("Project Notes:")).toBeInTheDocument();
    expect(screen.getByText("Keep the tone hopeful")).toBeInTheDocument();
    expect(screen.getByText("Focus on the reveal")).toBeInTheDocument();
    expect(screen.getByText("Direction")).toBeInTheDocument();
    expect(container.querySelectorAll(".agent-message-rich-list li")).toHaveLength(4);
  });

  it("keeps standard assistant formatting restrained without upgrading user formatting", () => {
    const { container } = render(
      <StandardCreateChatPanel
        messages={[
          {
            id: "u-1",
            role: "user",
            content:
              "Note:\nKeep the tone grounded.\n\nIf you want, keep the reveal for the very end.",
          },
          {
            id: "a-1",
            role: "assistant",
            content:
              "Best Direction:\nKeep the opening visual simple and emotionally clear.\n\n---\n\nIf you want, I can turn this into a generation-ready prompt next.",
          },
        ]}
        input=""
        showInput={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByText("Best Direction")).toBeInTheDocument();
    expect(
      screen.getByText("Keep the opening visual simple and emotionally clear.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("If you want, I can turn this into a generation-ready prompt next.")
    ).toBeInTheDocument();
    expect(container.querySelector(".agent-assistant .agent-message-rich-separator")).toBeNull();
    expect(container.querySelector(".agent-assistant .agent-message-rich-hint")).toBeNull();
    expect(container.querySelector(".agent-user .agent-message-rich-hint")).toBeNull();
    expect(container.querySelector(".agent-user .agent-message-rich-separator")).toBeNull();
    expect(
      screen.getByText((_, node) => node?.textContent === "Note:\nKeep the tone grounded.")
    ).toBeInTheDocument();
  });

  it("allows prompt artifacts to use the shared rich renderer when structured content is present", () => {
    const { container } = render(
      <StandardCreateChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "# Final Prompt\n\n1. Establish the scene\n2. Introduce the reveal",
            outputPrompt: "# Final Prompt\n\n1. Establish the scene\n2. Introduce the reveal",
            canUseAsPrompt: true,
          },
        ]}
        input=""
        showInput={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByText("Final Prompt")).toBeInTheDocument();
    expect(
      container.querySelector(".agent-message--prompt-output .agent-message-rich-body")
    ).not.toBeNull();
  });

  it("renders richer pulse-guided layouts with headings, reply chips, separators, and option cards", () => {
    const { container } = render(
      <PulseCreateChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content:
              "# Which Camera Motion Should You Use?\n\nChoose one option below or *type your own custom motion*.\n\nReply with:\n\n1 2 3 ... 10\n\nor type your own camera motion\n\n---\n\n## Camera Motion Options\n\n1 — Static\nLocked-off camera on a tripod. No movement — only the subject or environment moves.\n\n2 — Selfie (Handheld POV)\nFront-facing, arm’s-length framing with natural bob and micro-shake.",
          },
        ]}
        input=""
        showInput={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByText("Which Camera Motion Should You Use?")).toBeInTheDocument();
    expect(container.querySelector(".agent-message-rich-hint")).toHaveTextContent(
      "Choose one option below or type your own custom motion."
    );
    expect(screen.getByText("Reply with:")).toBeInTheDocument();
    expect(screen.getByText("Camera Motion Options")).toBeInTheDocument();
    expect(screen.getByText("1 — Static")).toBeInTheDocument();
    expect(screen.getByText("2 — Selfie (Handheld POV)")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Locked-off camera on a tripod. No movement — only the subject or environment moves."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Front-facing, arm’s-length framing with natural bob and micro-shake.")
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".agent-message-rich-choice-chip")).toHaveLength(5);
    expect(container.querySelector(".agent-message-rich-separator")).not.toBeNull();
  });

  it("removes title-case step headings from pulse-guided assistant replies", () => {
    render(
      <PulseCreateChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content:
              "CURRENT STEP\nCamera Motion\nWhich camera motion should I use? Pick one from the list below or type your own.",
          },
        ]}
        input=""
        showInput={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.queryByText("CURRENT STEP")).not.toBeInTheDocument();
    expect(screen.queryByText("Camera Motion")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Which camera motion should I use? Pick one from the list below or type your own."
      )
    ).toBeInTheDocument();
  });

  it("removes fused current-step labels from pulse-guided assistant replies", () => {
    render(
      <PulseCreateChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content:
              "CURRENT STEP\nConcept What is the single-shot concept you want to illustrate? Provide a topic or theme.",
          },
        ]}
        input=""
        showInput={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.queryByText("CURRENT STEP")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Concept What is the single-shot concept you want to illustrate? Provide a topic or theme."
      )
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "What is the single-shot concept you want to illustrate? Provide a topic or theme."
      )
    ).toBeInTheDocument();
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

  it("does not force-scroll chat history when only footer node identity changes", () => {
    const sharedProps = {
      messages: [{ id: "a-1", role: "assistant" as const, content: "Assistant output one." }],
      input: "",
      showInput: false,
      onInputChange: vi.fn(),
      onSend: vi.fn(),
    };
    const { container, rerender } = render(
      <AgentChatPanel
        {...sharedProps}
        historyFooterContent={<div data-testid="footer-one">Loading</div>}
      />
    );
    const messagesEl = container.querySelector(".agent-messages") as HTMLDivElement;
    Object.defineProperty(messagesEl, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    messagesEl.scrollTop = 120;
    fireEvent.scroll(messagesEl);

    rerender(
      <AgentChatPanel
        {...sharedProps}
        historyFooterContent={<div data-testid="footer-two">Loading</div>}
      />
    );

    expect(messagesEl.scrollTop).toBe(120);
    expect(screen.getByTestId("footer-two")).toBeInTheDocument();
  });

  it("keeps following new history while the user stays at the bottom", () => {
    let scrollHeightPx = 1000;
    const sharedProps = {
      messages: [{ id: "a-1", role: "assistant" as const, content: "Assistant output one." }],
      input: "",
      showInput: false,
      onInputChange: vi.fn(),
      onSend: vi.fn(),
    };
    const { container, rerender } = render(
      <AgentChatPanel
        {...sharedProps}
        historyFooterContent={<div data-testid="footer-one">Loading</div>}
      />
    );
    const messagesEl = container.querySelector(".agent-messages") as HTMLDivElement;
    Object.defineProperty(messagesEl, "clientHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(messagesEl, "scrollHeight", {
      configurable: true,
      get: () => scrollHeightPx,
    });
    Object.defineProperty(messagesEl, "scrollTop", {
      configurable: true,
      writable: true,
      value: 600,
    });
    fireEvent.scroll(messagesEl);

    scrollHeightPx = 1200;
    rerender(
      <AgentChatPanel
        {...sharedProps}
        messages={[
          { id: "a-1", role: "assistant" as const, content: "Assistant output one." },
          { id: "a-2", role: "assistant" as const, content: "Assistant output two." },
        ]}
        historyFooterContent={<div data-testid="footer-two">Loading</div>}
      />
    );

    expect(messagesEl.scrollTop).toBe(1200);
    expect(screen.getByTestId("footer-two")).toBeInTheDocument();
  });

  it("stops following history as soon as the user wheels upward during updates", () => {
    let scrollHeightPx = 1000;
    const sharedProps = {
      messages: [{ id: "a-1", role: "assistant" as const, content: "Assistant output one." }],
      input: "",
      showInput: false,
      onInputChange: vi.fn(),
      onSend: vi.fn(),
    };
    const { container, rerender } = render(
      <AgentChatPanel
        {...sharedProps}
        historyFooterContent={<div data-testid="footer-one">Loading</div>}
      />
    );
    const messagesEl = container.querySelector(".agent-messages") as HTMLDivElement;
    Object.defineProperty(messagesEl, "clientHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(messagesEl, "scrollHeight", {
      configurable: true,
      get: () => scrollHeightPx,
    });
    Object.defineProperty(messagesEl, "scrollTop", {
      configurable: true,
      writable: true,
      value: 600,
    });

    fireEvent.wheel(messagesEl, { deltaY: -80 });
    scrollHeightPx = 1200;
    rerender(
      <AgentChatPanel
        {...sharedProps}
        messages={[
          { id: "a-1", role: "assistant" as const, content: "Assistant output one." },
          { id: "a-2", role: "assistant" as const, content: "Assistant output two." },
        ]}
        historyFooterContent={<div data-testid="footer-two">Loading</div>}
      />
    );

    expect(messagesEl.scrollTop).toBe(600);
    expect(screen.getByTestId("footer-two")).toBeInTheDocument();
  });

  it("stops following history when the user starts dragging the scrollbar gutter", () => {
    let scrollHeightPx = 1000;
    const sharedProps = {
      messages: [{ id: "a-1", role: "assistant" as const, content: "Assistant output one." }],
      input: "",
      showInput: false,
      onInputChange: vi.fn(),
      onSend: vi.fn(),
    };
    const { container, rerender } = render(
      <AgentChatPanel
        {...sharedProps}
        historyFooterContent={<div data-testid="footer-one">Loading</div>}
      />
    );
    const messagesEl = container.querySelector(".agent-messages") as HTMLDivElement;
    Object.defineProperty(messagesEl, "clientHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(messagesEl, "scrollHeight", {
      configurable: true,
      get: () => scrollHeightPx,
    });
    Object.defineProperty(messagesEl, "scrollTop", {
      configurable: true,
      writable: true,
      value: 600,
    });
    vi.spyOn(messagesEl, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 640,
      height: 400,
      top: 0,
      right: 640,
      bottom: 400,
      left: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(messagesEl, { clientX: 634 });
    scrollHeightPx = 1200;
    rerender(
      <AgentChatPanel
        {...sharedProps}
        messages={[
          { id: "a-1", role: "assistant" as const, content: "Assistant output one." },
          { id: "a-2", role: "assistant" as const, content: "Assistant output two." },
        ]}
        historyFooterContent={<div data-testid="footer-two">Loading</div>}
      />
    );

    expect(messagesEl.scrollTop).toBe(600);
    expect(screen.getByTestId("footer-two")).toBeInTheDocument();
  });

  it("renders linked bubble thumbnails and status states without breaking generate controls", () => {
    const onGenerateOutputPrompt = vi.fn();
    render(
      <AgentChatPanel
        messages={[
          {
            id: "a-ready",
            role: "assistant",
            content: "Ready output.",
            outputPrompt: "Ready output.",
            canUseAsPrompt: true,
          },
          {
            id: "a-pending",
            role: "assistant",
            content: "Pending output.",
            outputPrompt: "Pending output.",
            canUseAsPrompt: true,
          },
          {
            id: "a-failed",
            role: "assistant",
            content: "Failed output.",
            outputPrompt: "Failed output.",
            canUseAsPrompt: true,
          },
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
        onGenerateOutputPrompt={onGenerateOutputPrompt}
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
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant prompt payload.",
            canUseAsPrompt: true,
          },
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
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
          },
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
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
          },
        ]}
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
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
          },
        ]}
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

  it("exposes prompt text on drag start from the assistant text surface and user bubble", () => {
    render(
      <AgentChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant prompt payload.",
            canUseAsPrompt: true,
          },
          { id: "u-1", role: "user", content: "User input one." },
        ]}
        input=""
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    const assistantText = screen.getByText("Assistant output one.");
    const assistantDragSurface = assistantText.closest(
      ".agent-message-prompt-drag-surface"
    ) as HTMLElement | null;
    const draggableMessage = assistantText.closest(".agent-message") as HTMLElement;
    const userBubble = screen.getByText("User input one.").closest(".agent-message") as HTMLElement;
    expect(assistantDragSurface).toBeTruthy();
    expect(draggableMessage).toBeTruthy();
    expect(userBubble).toBeTruthy();

    const setData = vi.fn();
    const setDragImage = vi.fn();
    const dataTransfer = {
      setData,
      setDragImage,
      effectAllowed: "none",
    } as unknown as DataTransfer;

    fireEvent.dragStart(assistantDragSurface as HTMLElement, { dataTransfer });
    expect(setData).toHaveBeenCalledWith("text/plain", "Assistant prompt payload.");
    expect(setData).toHaveBeenCalledWith("text/prompt", "Assistant prompt payload.");
    expect(setDragImage).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".agent-message-drag-ghost")).toHaveLength(1);
    expect(draggableMessage.classList.contains("is-dragging")).toBe(true);

    fireEvent.dragEnd(assistantDragSurface as HTMLElement);
    expect(document.querySelectorAll(".agent-message-drag-ghost")).toHaveLength(0);
    expect(draggableMessage.classList.contains("is-dragging")).toBe(false);

    fireEvent.dragStart(userBubble, { dataTransfer });
    expect(setData).toHaveBeenCalledWith("text/plain", "User input one.");
  });

  it("keeps completed Pulse artifact text draggable when generate controls are hidden", () => {
    render(
      <AgentChatPanel
        messages={[
          {
            id: "pulse-final",
            role: "assistant",
            content: "Completed Pulse artifact prompt.",
            outputPrompt: "Completed Pulse artifact prompt.",
            canUseAsPrompt: true,
          },
        ]}
        input=""
        assistantMessageClassName="agent-message--pulse-guided"
        hideOutputGenerateControls
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    const promptText = screen.getByText("Completed Pulse artifact prompt.");
    const draggableMessage = promptText.closest(".agent-message") as HTMLElement;
    const dragSurface = promptText.closest(".agent-message-prompt-drag-surface") as HTMLElement;
    expect(draggableMessage).toBeTruthy();
    expect(dragSurface).toBeTruthy();
    expect(draggableMessage).toHaveClass("agent-message--pulse-guided");
    expect(draggableMessage).toHaveClass("is-draggable");
    expect(draggableMessage).not.toHaveClass("agent-message--with-output-generate");
    expect(draggableMessage).toHaveAttribute("draggable", "false");

    const setData = vi.fn();
    const dataTransfer = {
      setData,
      effectAllowed: "none",
    } as unknown as DataTransfer;

    fireEvent.dragStart(dragSurface, { dataTransfer });
    expect(setData).toHaveBeenCalledWith("text/plain", "Completed Pulse artifact prompt.");
    expect(setData).toHaveBeenCalledWith("text/prompt", "Completed Pulse artifact prompt.");

    fireEvent.dragEnd(dragSurface);
    expect(draggableMessage.classList.contains("is-dragging")).toBe(false);
  });

  it("keeps the staged prompt draggable only from its text surface", () => {
    render(
      <AgentChatPanel
        messages={[]}
        input=""
        stagedPrompt="Assistant staged prompt."
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    const promptText = screen.getByText("Assistant staged prompt.");
    const draggableMessage = promptText.closest(".agent-message") as HTMLElement;
    const dragSurface = promptText.closest(".agent-message-prompt-drag-surface") as HTMLElement;
    expect(draggableMessage).toBeTruthy();
    expect(dragSurface).toBeTruthy();
    expect(draggableMessage).toHaveAttribute("draggable", "false");
    expect(dragSurface).toHaveAttribute("draggable", "true");

    const setData = vi.fn();
    const setDragImage = vi.fn();
    const dataTransfer = {
      setData,
      setDragImage,
      effectAllowed: "none",
    } as unknown as DataTransfer;

    fireEvent.dragStart(dragSurface, { dataTransfer });
    expect(setData).toHaveBeenCalledWith("text/plain", "Assistant staged prompt.");
    expect(setData).toHaveBeenCalledWith("text/prompt", "Assistant staged prompt.");
    expect(draggableMessage.classList.contains("is-dragging")).toBe(true);

    fireEvent.dragEnd(dragSurface);
    expect(draggableMessage.classList.contains("is-dragging")).toBe(false);
  });

  it("keeps assistant bubble draggable from text area when output preview media exists", () => {
    render(
      <AgentChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
          },
        ]}
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
    const dragSurface = messageText.closest(".agent-message-prompt-drag-surface") as HTMLElement;
    const draggableMessage = messageText.closest(".agent-message") as HTMLElement;
    expect(dragSurface).toBeTruthy();
    expect(draggableMessage).toBeTruthy();

    const setData = vi.fn();
    const setDragImage = vi.fn();
    const dataTransfer = {
      setData,
      setDragImage,
      effectAllowed: "none",
    } as unknown as DataTransfer;

    fireEvent.dragStart(dragSurface, { dataTransfer });
    expect(setData).toHaveBeenCalledWith("text/prompt", "Assistant output one.");
    expect(draggableMessage.classList.contains("is-dragging")).toBe(true);

    fireEvent.dragEnd(dragSurface);
    expect(draggableMessage.classList.contains("is-dragging")).toBe(false);
  });

  it("blocks drag start from inline output preview media", () => {
    render(
      <AgentChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
          },
        ]}
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
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
          },
        ]}
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

    const promptText = screen.getByText("Assistant output one.");
    const dragSurface = promptText.closest(".agent-message-prompt-drag-surface") as HTMLElement;
    const draggableMessage = promptText.closest(".agent-message") as HTMLElement;
    expect(dragSurface).toBeTruthy();
    expect(draggableMessage).toBeTruthy();

    const setData = vi.fn();
    const setDragImage = vi.fn();
    const dataTransfer = {
      setData,
      setDragImage,
      effectAllowed: "none",
    } as unknown as DataTransfer;

    fireEvent.dragStart(dragSurface, { dataTransfer });

    const ghost = document.querySelector(".agent-message-drag-ghost") as HTMLElement | null;
    expect(ghost).toBeTruthy();
    expect(ghost?.querySelector(".agent-output-bubble-controls")).toBeNull();
    if (ghost) {
      expect(within(ghost).queryByText("Generating preview…")).toBeNull();
    }

    fireEvent.dragEnd(dragSurface);
    expect(document.querySelector(".agent-message-drag-ghost")).toBeNull();
  });

  it("does not start a prompt drag from the assistant bubble container outside the text surface", () => {
    render(
      <AgentChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
          },
        ]}
        input=""
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    const bubble = screen
      .getByText("Assistant output one.")
      .closest(".agent-message") as HTMLElement;
    const setData = vi.fn();
    const dataTransfer = {
      setData,
      effectAllowed: "none",
    } as unknown as DataTransfer;

    fireEvent.dragStart(bubble, { dataTransfer });

    expect(setData).not.toHaveBeenCalled();
    expect(bubble.classList.contains("is-dragging")).toBe(false);
  });

  it("does not start a prompt drag from attachment preview images inside assistant bubbles", () => {
    render(
      <AgentChatPanel
        messages={[
          {
            id: "a-1",
            role: "assistant",
            content: "Assistant output one.",
            outputPrompt: "Assistant output one.",
            canUseAsPrompt: true,
            attachments: [
              {
                id: "img-1",
                kind: "image",
                imageUrl: "https://example.com/ref.png",
              },
            ],
          },
        ]}
        input=""
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    const previewImage = document.querySelector(
      ".agent-attachment-card-media"
    ) as HTMLElement | null;
    const bubble = screen
      .getByText("Assistant output one.")
      .closest(".agent-message") as HTMLElement;
    expect(previewImage).toBeTruthy();

    const setData = vi.fn();
    const dataTransfer = {
      setData,
      effectAllowed: "none",
    } as unknown as DataTransfer;

    fireEvent.dragStart(previewImage as HTMLElement, { dataTransfer });

    expect(setData).not.toHaveBeenCalled();
    expect(bubble.classList.contains("is-dragging")).toBe(false);
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

  it("uses a custom thinking label when provided", () => {
    render(
      <AgentChatPanel
        messages={[{ id: "u-1", role: "user", content: "Research this." }]}
        input=""
        isSending
        showThinkingIndicator
        thinkingIndicatorPlacement="history"
        thinkingIndicatorLabel="Researching online…"
        onInputChange={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByText("Researching online…")).toBeInTheDocument();
    expect(screen.queryByText("Thinking…")).toBeNull();
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
