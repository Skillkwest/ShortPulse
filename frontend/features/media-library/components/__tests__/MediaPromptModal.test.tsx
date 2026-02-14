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
});
