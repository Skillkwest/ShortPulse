import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaLibraryPromptGrid } from "../MediaLibraryPromptGrid";

const PROMPTS = [
  {
    id: "prompt-1",
    title: "Prompt One",
    prompt_text: "Cinematic portrait prompt",
    created_at: "2026-03-03T00:00:00.000Z",
  },
];

describe("MediaLibraryPromptGrid", () => {
  it("renders default prompt cards for legacy/modal variant", () => {
    render(
      <MediaLibraryPromptGrid
        prompts={PROMPTS}
        sortedPrompts={PROMPTS}
        selectedIds={new Set<string>()}
        onSelectPromptCard={vi.fn()}
      />
    );

    const button = screen.getByRole("button", { name: "Select prompt Prompt One" });
    expect(button).toHaveClass("prompt-card");
    expect(button).not.toHaveClass("reference-card");
  });

  it("renders reference-style cards for panel variant and selects prompt", () => {
    const onSelectPromptCard = vi.fn();
    render(
      <MediaLibraryPromptGrid
        prompts={PROMPTS}
        sortedPrompts={PROMPTS}
        selectedIds={new Set<string>(["prompt-1"])}
        onSelectPromptCard={onSelectPromptCard}
        variant="reference-card"
      />
    );

    const button = screen.getByRole("button", { name: "Deselect prompt Prompt One" });
    expect(button).toHaveClass("reference-card");
    expect(button).toHaveClass("has-text");
    expect(button).toHaveClass("is-active");
    expect(screen.getByText("Cinematic portrait prompt")).toBeInTheDocument();

    fireEvent.click(button);
    expect(onSelectPromptCard).toHaveBeenCalledWith(PROMPTS[0]);
  });
});
