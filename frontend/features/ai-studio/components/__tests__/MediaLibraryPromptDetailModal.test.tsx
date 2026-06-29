import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  const installClipboardWriteMock = () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    return {
      writeText,
      restore: () => {
        if (originalDescriptor) {
          Object.defineProperty(globalThis.navigator, "clipboard", originalDescriptor);
          return;
        }
        Reflect.deleteProperty(globalThis.navigator, "clipboard");
      },
    };
  };

  it("renders saved prompt text in the shared text-detail layout", () => {
    render(<MediaLibraryPromptDetailModal item={createItem()} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Text reference detail" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Prompt One" })).toBeInTheDocument();
    expect(screen.queryByText("Text detail")).not.toBeInTheDocument();
    expect(document.querySelector(".art-modal-meta-pill")).toBeNull();
    expect(
      (screen.getByDisplayValue("A cinematic portrait with soft rim light") as HTMLTextAreaElement)
        .readOnly
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Saved" })).not.toBeInTheDocument();
  });

  it("copies saved prompt text from the text-area corner action", async () => {
    const clipboard = installClipboardWriteMock();

    try {
      render(<MediaLibraryPromptDetailModal item={createItem()} onClose={vi.fn()} />);

      const copyButton = screen.getByRole("button", { name: "Copy prompt" });
      expect(copyButton.closest(".art-text-detail-textarea-shell")).not.toBeNull();
      expect(copyButton.closest(".art-modal-action-row")).toBeNull();

      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(clipboard.writeText).toHaveBeenCalledWith(
          "A cinematic portrait with soft rim light"
        );
      });
    } finally {
      clipboard.restore();
    }
  });

  it("labels untitled saved prompts as text references", () => {
    const item = createMediaLibraryPromptDetailModalItem({
      prompt: {
        ...prompt,
        id: "prompt-untitled",
        title: null,
      },
      surface: "media-library-panel",
    });

    render(<MediaLibraryPromptDetailModal item={item} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Text reference detail" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Text reference" })).toBeInTheDocument();
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
