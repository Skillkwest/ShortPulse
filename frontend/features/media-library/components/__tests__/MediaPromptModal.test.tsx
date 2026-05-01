import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaPromptModal } from "../MediaPromptModal";

describe("MediaPromptModal", () => {
  it("wires edit, save, delete, and close interactions", () => {
    const closePromptModal = vi.fn();
    const deletePrompt = vi.fn(async () => true);
    const handlePromptEditChange = vi.fn();
    const savePromptEdits = vi.fn(async () => {});

    render(
      <MediaPromptModal
        closePromptModal={closePromptModal}
        deletePrompt={deletePrompt}
        focusedPrompt={{ id: "prompt-1" }}
        handlePromptEditChange={handlePromptEditChange}
        promptEditValue="draft"
        promptModalError={null}
        promptSaveSuccess={false}
        savePromptEdits={savePromptEdits}
        savingPromptEdit={false}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Edit your prompt..."), {
      target: { value: "updated prompt" },
    });
    expect(handlePromptEditChange).toHaveBeenCalledWith("updated prompt");

    fireEvent.click(screen.getByRole("button", { name: "Save edits" }));
    expect(savePromptEdits).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(deletePrompt).toHaveBeenCalledWith({ id: "prompt-1" }, { fromPromptModal: true });

    fireEvent.click(screen.getByRole("button", { name: "Close prompt editor" }));
    expect(closePromptModal).toHaveBeenCalled();
  });

  it("does not close when prompt text selection overextends to the backdrop", () => {
    const closePromptModal = vi.fn();
    render(
      <MediaPromptModal
        closePromptModal={closePromptModal}
        deletePrompt={vi.fn(async () => true)}
        focusedPrompt={{ id: "prompt-1" }}
        handlePromptEditChange={vi.fn()}
        promptEditValue="draft"
        promptModalError={null}
        promptSaveSuccess={false}
        savePromptEdits={vi.fn(async () => {})}
        savingPromptEdit={false}
      />
    );

    const textarea = screen.getByPlaceholderText("Edit your prompt...");
    const backdrop = document.querySelector(".media-modal-backdrop");
    expect(backdrop).not.toBeNull();

    fireEvent.pointerDown(textarea, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(backdrop as Element, { button: 0, pointerId: 1 });
    fireEvent.click(backdrop as Element);

    expect(closePromptModal).not.toHaveBeenCalled();
  });
});
