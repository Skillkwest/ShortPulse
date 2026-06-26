import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMediaLibraryPromptDetailModalItem } from "../../logic/mediaLibraryPromptDetailModal";
import type { PromptRow } from "../../logic/mediaLibraryModalModel";
import { MediaLibraryPromptDetailModal } from "../media-library-modal/MediaLibraryPromptDetailModal";

describe("MediaLibraryPromptDetailModal", () => {
  const prompt: PromptRow = {
    id: "prompt-1",
    title: "Prompt One",
    prompt_text: "A cinematic portrait with soft rim light",
    mode: "text",
    source: "manual",
    created_at: "2026-06-21T12:00:00.000Z",
  };

  const createItem = () =>
    createMediaLibraryPromptDetailModalItem({
      prompt,
      surface: "media-library-panel",
    });

  it("renders saved prompt text in the shared text-detail layout", () => {
    render(<MediaLibraryPromptDetailModal item={createItem()} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Saved prompt detail" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Prompt One" })).toBeInTheDocument();
    expect(screen.queryByText("Text detail")).not.toBeInTheDocument();
    expect(document.querySelector(".art-modal-meta-pill")).toBeNull();
    expect(
      (screen.getByDisplayValue("A cinematic portrait with soft rim light") as HTMLTextAreaElement)
        .readOnly
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
  });

  it("preserves long saved prompt text in the text-detail textarea", () => {
    const longPrompt = Array.from(
      { length: 32 },
      (_, index) => `Prompt line ${index + 1}: keep every detail visible and available.`
    ).join("\n");
    const item = createMediaLibraryPromptDetailModalItem({
      prompt: {
        ...prompt,
        id: "prompt-long",
        prompt_text: longPrompt,
      },
      surface: "media-library-panel",
    });

    render(<MediaLibraryPromptDetailModal item={item} onClose={vi.fn()} />);

    const textarea = document.querySelector(
      ".art-text-detail-textarea"
    ) as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    expect(textarea).toHaveValue(longPrompt);
    expect(textarea?.readOnly).toBe(true);
  });

  it("routes Use and Delete actions to the selected prompt item", () => {
    const item = createItem();
    const onUsePromptItem = vi.fn();
    const onDeletePromptItem = vi.fn();
    render(
      <MediaLibraryPromptDetailModal
        item={item}
        onClose={vi.fn()}
        onUsePromptItem={onUsePromptItem}
        onDeletePromptItem={onDeletePromptItem}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Use prompt" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onUsePromptItem).toHaveBeenCalledWith(item);
    expect(onDeletePromptItem).toHaveBeenCalledWith(item);
  });
});
