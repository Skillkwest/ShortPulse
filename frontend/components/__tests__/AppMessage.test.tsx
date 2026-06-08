import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppMessage, useTransientAppMessage } from "../AppMessage";

describe("AppMessage", () => {
  it("uses urgent accessibility defaults for errors", () => {
    render(<AppMessage tone="error" message="Upload failed." />);

    const message = screen.getByRole("alert");
    expect(message).toHaveAttribute("aria-live", "assertive");
    expect(message).toHaveAttribute("data-tone", "error");
  });

  it("uses polite status defaults for non-error tones", () => {
    render(<AppMessage tone="warning" message="Storage is almost full." />);

    const message = screen.getByRole("status");
    expect(message).toHaveAttribute("aria-live", "polite");
    expect(message).toHaveAttribute("data-mode", "banner");
  });

  it("renders actions and dismissal controls", async () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    render(
      <AppMessage
        tone="info"
        mode="toast"
        message="New media saved."
        action={{ label: "View", onClick: onAction }}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("useTransientAppMessage", () => {
  it("shows, fades, and clears a transient message", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useTransientAppMessage({ visibleMs: 100, fadeMs: 50 }));

    act(() => result.current.show("Saved.", "success"));
    expect(result.current.message).toMatchObject({
      message: "Saved.",
      tone: "success",
      fading: false,
    });

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.message).toMatchObject({ fading: true });

    act(() => vi.advanceTimersByTime(50));
    expect(result.current.message).toBeNull();

    vi.useRealTimers();
  });
});
