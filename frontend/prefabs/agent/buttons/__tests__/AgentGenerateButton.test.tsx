/**
 * Tests for the shared generate-action prefab.
 * Verifies cost rendering plus the exposed busy/disabled button contract.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentGenerateButton } from "../AgentGenerateButton";

describe("AgentGenerateButton", () => {
  it("renders generate label and credits", () => {
    render(<AgentGenerateButton onClick={vi.fn()} cost={12} />);

    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toHaveTextContent("Generate");
    expect(button).toHaveTextContent("12");
  });

  it("exposes busy state on the rendered button", () => {
    render(<AgentGenerateButton onClick={vi.fn()} cost={7} isBusy />);

    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("is-busy");
  });

  it("honors disabled state", () => {
    const onClick = vi.fn();
    render(<AgentGenerateButton onClick={onClick} cost={5} disabled />);

    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
