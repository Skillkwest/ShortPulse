import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaDeleteConfirmModal } from "../MediaDeleteConfirmModal";

describe("MediaDeleteConfirmModal", () => {
  it("renders copy and delegates cancel/confirm actions", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <MediaDeleteConfirmModal
        body={
          <>
            This will permanently remove <strong>file-1.png</strong>.
          </>
        }
        cancelDisabled={false}
        confirmDisabled={false}
        confirmLabel="Yes, delete file"
        confirmTitleId="delete-file-title"
        onCancel={onCancel}
        onConfirm={onConfirm}
        title="Delete this file from your library?"
      />
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-labelledby", "delete-file-title");
    expect(screen.getByText("Delete this file from your library?")).toBeInTheDocument();
    expect(screen.getByText("file-1.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete file" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
