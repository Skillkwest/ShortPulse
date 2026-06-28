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

const makePrompts = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `prompt-${index + 1}`,
    title: `Prompt ${index + 1}`,
    prompt_text: `Prompt text ${index + 1}`,
    created_at: "2026-03-03T00:00:00.000Z",
  }));

describe("MediaLibraryPromptGrid", () => {
  it("renders default prompt cards for legacy/modal variant", () => {
    const { container } = render(
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
    expect(container.querySelector(".media-library-modal-grid-virtualized")).toBeNull();
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

  it("uses the virtualized shell for deep reference-card prompt lists", () => {
    const prompts = makePrompts(60);
    const { container } = render(
      <MediaLibraryPromptGrid
        prompts={prompts}
        sortedPrompts={prompts}
        selectedIds={new Set<string>()}
        onSelectPromptCard={vi.fn()}
        variant="reference-card"
      />
    );

    const grid = container.querySelector(".media-library-prompt-grid--reference-cards");

    expect(grid).toHaveClass("media-library-modal-grid-virtualized");
    expect((grid as HTMLElement).style.height).toMatch(/px$/);
  });
});
