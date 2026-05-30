import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExpertEditPanelView } from "../ExpertEditPanelView";

vi.mock("next/image", () => ({
  default: (props: { alt?: string; [key: string]: unknown }) => {
    const forwarded = { ...props };
    delete forwarded.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt ?? ""} {...forwarded} />;
  },
}));

const baseProps: React.ComponentProps<typeof ExpertEditPanelView> = {
  aspect: "1:1",
  modelId: "fal-ai/nano-banana-2/edit",
  modelLabel: "Nano Banana 2",
  referenceImageUrl: "https://example.com/reference.png",
  extraImageUrls: [null, null, null],
  referenceText: "Clean up edges and relight softly",
  aspectOptions: [
    { value: "1:1", label: "1:1" },
    { value: "16:9", label: "16:9" },
  ],
  isModelModalOpen: false,
  modelModalAnchor: null,
  onAspectChange: vi.fn(),
  onModelPickerOpen: vi.fn(),
  onPrimaryImageChange: vi.fn(),
  onExtraImageChange: vi.fn(),
  onPromptTextChange: vi.fn(),
  onRegenerate: vi.fn(),
};

describe("ExpertEditPanelView launch lock", () => {
  it("hides non-standard edit mode UI while keeping move controls available", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    expect(screen.queryByText("Select Edit Mode")).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: /generation mode/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Inpaint action tools")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /move tools/i })).toBeInTheDocument();
  });

  it("removes the context-menu expand entry while launch lock is active", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.contextMenu(screen.getByLabelText("Primary composition surface"));

    const menu = screen.getByRole("menu", { name: /stage actions/i });
    expect(within(menu).queryByRole("menuitem", { name: /^expand$/i })).not.toBeInTheDocument();
  });
});
