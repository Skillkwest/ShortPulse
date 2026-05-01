import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGuardedBackdropDismiss } from "../useGuardedBackdropDismiss";

function GuardedBackdropHarness({ onDismiss }: { onDismiss: () => void }) {
  const backdropProps = useGuardedBackdropDismiss<HTMLDivElement>(onDismiss);

  return (
    <div data-testid="backdrop" {...backdropProps}>
      <div data-testid="dialog">
        <textarea aria-label="Editable text" defaultValue="selectable modal text" />
      </div>
    </div>
  );
}

describe("useGuardedBackdropDismiss", () => {
  it("dismisses once for a clean pointer gesture on the backdrop", () => {
    const onDismiss = vi.fn();
    render(<GuardedBackdropHarness onDismiss={onDismiss} />);

    const backdrop = screen.getByTestId("backdrop");
    fireEvent.pointerDown(backdrop, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(backdrop, { button: 0, pointerId: 1 });
    fireEvent.click(backdrop);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("preserves click-only dismiss fallback for synthetic and keyboard-like clicks", () => {
    const onDismiss = vi.fn();
    render(<GuardedBackdropHarness onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId("backdrop"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss when a selection-style gesture starts inside the dialog", () => {
    const onDismiss = vi.fn();
    render(<GuardedBackdropHarness onDismiss={onDismiss} />);

    const textarea = screen.getByLabelText("Editable text");
    const backdrop = screen.getByTestId("backdrop");

    fireEvent.pointerDown(textarea, { button: 0, pointerId: 2 });
    fireEvent.pointerUp(backdrop, { button: 0, pointerId: 2 });
    fireEvent.click(backdrop);

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
