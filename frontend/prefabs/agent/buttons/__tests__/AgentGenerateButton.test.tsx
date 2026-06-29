/**
 * Tests for the shared generate-action prefab.
 * Verifies cost rendering plus the validation-only disabled button contract.
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

  it("honors disabled state", () => {
    const onClick = vi.fn();
    render(<AgentGenerateButton onClick={onClick} cost={5} disabled />);

    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fails closed when cost is unavailable", () => {
    const onClick = vi.fn();
    render(<AgentGenerateButton onClick={onClick} cost={null} />);

    const button = screen.getByRole("button", { name: "Generate: cost estimate pending" });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Cost pending");
    expect(button).toHaveAttribute("title", "Cost estimate pending");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("treats undefined cost as unavailable", () => {
    render(<AgentGenerateButton onClick={vi.fn()} cost={undefined} />);

    const button = screen.getByRole("button", { name: "Generate: cost estimate pending" });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Cost pending");
  });

  it("does not expose busy semantics when active", () => {
    render(<AgentGenerateButton onClick={vi.fn()} cost={7} />);

    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).not.toHaveClass("is-busy");
  });
});
