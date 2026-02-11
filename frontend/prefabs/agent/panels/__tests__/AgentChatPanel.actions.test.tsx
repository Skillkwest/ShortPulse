/**
 * AgentChatPanel action parity tests.
 * Ensures expanded chat can expose prompt ownership status and action chips.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentChatPanel } from "../AgentChatPanel";

describe("AgentChatPanel prompt actions", () => {
  it("renders primary prompt status and action chips when enabled", () => {
    render(
      <AgentChatPanel
        messages={[]}
        input=""
        showPromptActions
        primaryPrompt="cinematic neon city alley at night"
        primarySource="agent"
        agentActions={{
          applyPrompt: "cinematic neon city alley at night",
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
    expect(screen.getByRole("button", { name: "Apply latest prompt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Describe refs (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "close-up framing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Should this be rainy?" })).toBeInTheDocument();
  });

  it("routes action clicks to callbacks", () => {
    const onApplyPrompt = vi.fn();
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
          applyPrompt: "cinematic neon city alley at night",
          variations: ["close-up framing"],
          questions: ["Should this be rainy?"],
          describeTargets: ["ref-a", "ref-b"],
        }}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onAgentApplyPrompt={onApplyPrompt}
        onAgentSelectVariation={onSelectVariation}
        onAgentUseQuestion={onUseQuestion}
        onAgentDescribeTargets={onDescribeTargets}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply latest prompt" }));
    expect(onApplyPrompt).toHaveBeenCalledWith("cinematic neon city alley at night");

    fireEvent.click(screen.getByRole("button", { name: "close-up framing" }));
    expect(onSelectVariation).toHaveBeenCalledWith("close-up framing");

    fireEvent.click(screen.getByRole("button", { name: "Should this be rainy?" }));
    expect(onUseQuestion).toHaveBeenCalledWith("Should this be rainy?");

    fireEvent.click(screen.getByRole("button", { name: "Describe refs (2)" }));
    expect(onDescribeTargets).toHaveBeenCalledWith(["ref-a", "ref-b"]);
  });
});
