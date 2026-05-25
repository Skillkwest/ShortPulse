import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateModeToggle } from "../CreateModeToggle";

describe("CreateModeToggle", () => {
  it("uses roving tab focus for the active mode", () => {
    render(<CreateModeToggle value="pulse" />);

    expect(screen.getByRole("tab", { name: "Pulse" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Standard" })).toHaveAttribute("tabindex", "-1");
  });

  it("switches modes with arrow-key navigation", () => {
    const onChange = vi.fn();
    render(<CreateModeToggle value="standard" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Standard" }), {
      key: "ArrowRight",
    });

    expect(onChange).toHaveBeenCalledWith("pulse");
  });
});
