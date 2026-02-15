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

  it("renders agent action controls when actions are available", () => {
    render(
      <PromptStep
        {...baseProps}
        agentActions={{
          variations: ["variation one"],
          questions: ["Should this be 16:9?"],
          describeTargets: ["ref-1"],
        }}
      />
    );

    expect(screen.getByRole("button", { name: "Describe refs (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "variation one" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Should this be 16:9?" })).toBeInTheDocument();
  });

  it("keeps inline chat visible in chat-only mode when expanded chat state is true", () => {
    render(<PromptStep {...baseProps} agentChatOpen />);

    expect(screen.getByPlaceholderText("Message the agent...")).toBeInTheDocument();
  });

  it("fires action callbacks with sanitized payloads", () => {
    const onAgentSelectVariation = vi.fn();
    const onAgentUseQuestion = vi.fn();
    const onAgentDescribeTargets = vi.fn();

    render(
      <PromptStep
        {...baseProps}
        agentActions={{
          variations: ["variation one"],
          questions: ["Should this be 16:9?"],
          describeTargets: ["ref-1", "ref-2"],
        }}
        onAgentSelectVariation={onAgentSelectVariation}
        onAgentUseQuestion={onAgentUseQuestion}
        onAgentDescribeTargets={onAgentDescribeTargets}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "variation one" }));
    expect(onAgentSelectVariation).toHaveBeenCalledWith("variation one");

    fireEvent.click(screen.getByRole("button", { name: "Should this be 16:9?" }));
    expect(onAgentUseQuestion).toHaveBeenCalledWith("Should this be 16:9?");

    fireEvent.click(screen.getByRole("button", { name: "Describe refs (2)" }));
    expect(onAgentDescribeTargets).toHaveBeenCalledWith(["ref-1", "ref-2"]);
  });
});
