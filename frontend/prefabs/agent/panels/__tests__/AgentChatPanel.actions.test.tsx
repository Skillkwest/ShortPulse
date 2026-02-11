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
});
