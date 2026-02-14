import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaPromptGrid } from "../MediaPromptGrid";

type PromptRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: string;
  created_at: string;
};

describe("MediaPromptGrid", () => {
  it("wires prompt selection, open, and delete actions", () => {
    const togglePromptSelect = vi.fn();
    const openPromptModal = vi.fn();
    const deletePrompt = vi.fn(async () => true);
    const prompt: PromptRow = {
      id: "prompt-1",
      title: "Prompt One",
      prompt_text: "Describe a city skyline",
      mode: "image",
      created_at: "2026-02-14T00:00:00.000Z",
    };

    const { container } = render(
      <MediaPromptGrid
        deletePrompt={deletePrompt}
        formatDate={() => "Feb 14"}
        openPromptModal={openPromptModal}
        prompts={[prompt]}
        selectedIds={[]}
        togglePromptSelect={togglePromptSelect}
      />
    );

    const card = container.querySelector(".prompt-card");
    expect(card).not.toBeNull();
    if (card) {
      fireEvent.click(card);
      fireEvent.doubleClick(card);
    }
    expect(togglePromptSelect).toHaveBeenCalledWith("prompt-1");
    expect(openPromptModal).toHaveBeenCalledWith(prompt);

    fireEvent.click(screen.getByRole("button", { name: "Delete prompt: Prompt One" }));
    expect(deletePrompt).toHaveBeenCalledWith(prompt);
  });
});
