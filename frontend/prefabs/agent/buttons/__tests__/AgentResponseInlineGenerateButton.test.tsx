/**
 * Tests for the reusable response-style inline generate prefab.
 * Validates rendering, disabled behavior, and optional propagation guards.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentResponseInlineGenerateButton } from "../AgentResponseInlineGenerateButton";

describe("AgentResponseInlineGenerateButton", () => {
  it("fails closed with pending-cost copy when cost is missing", () => {
    render(<AgentResponseInlineGenerateButton onClick={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Cost pending");
    expect(button).toHaveAccessibleDescription("Cost pending");
  });

  it("renders localized cost and calls onClick", () => {
    const onClick = vi.fn();
    render(<AgentResponseInlineGenerateButton onClick={onClick} costCredits={1234} />);

    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toHaveTextContent("1,234");
    expect(button).toHaveAccessibleDescription("1,234");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("honors disabled state", () => {
    const onClick = vi.fn();
    render(<AgentResponseInlineGenerateButton onClick={onClick} costCredits={5} disabled />);

    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stops click and double-click propagation when enabled", () => {
    const parentClick = vi.fn();
    const parentDoubleClick = vi.fn();
    const onClick = vi.fn();
    render(
      <div onClick={parentClick} onDoubleClick={parentDoubleClick}>
        <AgentResponseInlineGenerateButton onClick={onClick} costCredits={4} stopPropagation />
      </div>
    );

    const button = screen.getByRole("button", { name: "Generate" });
    fireEvent.click(button);
    fireEvent.doubleClick(button);

    expect(onClick).toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
    expect(parentDoubleClick).not.toHaveBeenCalled();
  });

  it("stays visibly ready when enabled", () => {
    render(<AgentResponseInlineGenerateButton onClick={vi.fn()} costCredits={4} />);

    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toBeEnabled();
    expect(button).toHaveAccessibleDescription("4");
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button.classList.contains("is-busy")).toBe(false);
  });
});
