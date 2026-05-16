/**
 * Unit tests for the reusable profile preference toggle card component.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfilePreferenceToggleCard } from "../ProfilePreferenceToggleCard";

const baseProps = {
  title: "Media Library autosave",
  description: "Autosave generated media to your library.",
  enabled: true,
  onToggle: vi.fn(),
  enabledHelperText: "Autosave is on.",
  disabledHelperText: "Autosave is off.",
};

describe("ProfilePreferenceToggleCard", () => {
  it("renders helper text based on enabled state", () => {
    const { rerender } = render(<ProfilePreferenceToggleCard {...baseProps} />);
    expect(screen.getByText("Autosave is on.")).toBeInTheDocument();

    rerender(<ProfilePreferenceToggleCard {...baseProps} enabled={false} />);
    expect(screen.getByText("Autosave is off.")).toBeInTheDocument();
  });

  it("calls onToggle with inverse state", () => {
    const onToggle = vi.fn();
    render(<ProfilePreferenceToggleCard {...baseProps} enabled onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: "Disable Media Library autosave" }));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("does not toggle when disabled", () => {
    const onToggle = vi.fn();
    render(<ProfilePreferenceToggleCard {...baseProps} disabled onToggle={onToggle} />);

    const toggleButton = screen.getByRole("button", { name: "Disable Media Library autosave" });
    expect(toggleButton).toBeDisabled();
    fireEvent.click(toggleButton);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("renders saving and error status messages", () => {
    render(
      <ProfilePreferenceToggleCard
        {...baseProps}
        saving
        error="Unable to update media autosave preference"
      />
    );

    expect(screen.getByText("Saving autosave preference...")).toBeInTheDocument();
    expect(screen.getByText("Unable to update media autosave preference")).toBeInTheDocument();
  });
});
