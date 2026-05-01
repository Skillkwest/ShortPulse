import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationModal } from "../ConfirmationModal";

describe("ConfirmationModal", () => {
  it("keeps the dialog open when a selection-style gesture starts inside the body", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmationModal
        title="Delete item?"
        body={<textarea aria-label="Confirmation notes" defaultValue="Readable text" />}
        confirmLabel="Delete"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText("Confirmation notes");
    const backdrop = document.querySelector(".confirm-modal-backdrop");
    expect(backdrop).not.toBeNull();

    fireEvent.pointerDown(textarea, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(backdrop as Element, { button: 0, pointerId: 1 });
    fireEvent.click(backdrop as Element);

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("still cancels on an intentional backdrop click", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmationModal
        title="Delete item?"
        body={<p>Body text</p>}
        confirmLabel="Delete"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );

    const backdrop = document.querySelector(".confirm-modal-backdrop");
    expect(backdrop).not.toBeNull();

    fireEvent.click(backdrop as Element);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
