/**
 * Tests for the reusable response-style inline generate prefab.
 * Validates rendering, disabled behavior, and optional propagation guards.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentResponseInlineGenerateButton } from "../AgentResponseInlineGenerateButton";

describe("AgentResponseInlineGenerateButton", () => {
  it("renders generate label and fallback cost when missing", () => {
    render(<AgentResponseInlineGenerateButton onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders localized cost and calls onClick", () => {
    const onClick = vi.fn();
    render(<AgentResponseInlineGenerateButton onClick={onClick} costCredits={1234} />);

    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toHaveTextContent("1,234");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("honors disabled state", () => {
    const onClick = vi.fn();
    render(<AgentResponseInlineGenerateButton onClick={onClick} disabled />);

    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("exposes busy semantics when requested", () => {
    render(<AgentResponseInlineGenerateButton onClick={vi.fn()} isBusy />);

    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.classList.contains("is-busy")).toBe(true);
  });

  it("stops click and double-click propagation when enabled", () => {
    const parentClick = vi.fn();
    const parentDoubleClick = vi.fn();
    const onClick = vi.fn();
    render(
      <div onClick={parentClick} onDoubleClick={parentDoubleClick}>
        <AgentResponseInlineGenerateButton onClick={onClick} stopPropagation />
      </div>
    );

    const button = screen.getByRole("button", { name: "Generate" });
    fireEvent.click(button);
    fireEvent.doubleClick(button);

    expect(onClick).toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
    expect(parentDoubleClick).not.toHaveBeenCalled();
  });
});
