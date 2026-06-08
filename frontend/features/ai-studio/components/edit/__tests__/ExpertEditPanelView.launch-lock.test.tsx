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
    { value: "1:1", ratioLabel: "1:1", name: "Square", orientation: "square" },
    { value: "16:9", ratioLabel: "16:9", name: "Landscape", orientation: "widescreen" },
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
  it("starts with two secondary reference slots and can add or remove visible slots", () => {
    const onExtraImageChange = vi.fn();
    render(<ExpertEditPanelView {...baseProps} onExtraImageChange={onExtraImageChange} />);

    expect(screen.getByLabelText("Secondary edit image 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 2")).toBeInTheDocument();
    expect(screen.queryByLabelText("Secondary edit image 3")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add reference slot" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add reference slot" }));

    expect(screen.getByLabelText("Secondary edit image 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove reference slot 3" }));

    expect(onExtraImageChange).toHaveBeenCalledWith(2, null);
    expect(screen.queryByLabelText("Secondary edit image 3")).not.toBeInTheDocument();
  });

  it("hides non-standard edit mode UI while keeping move controls available", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    expect(screen.queryByText("Select Edit Mode")).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: /generation mode/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Inpaint action tools")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /undo move action/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redo move action/i })).toBeInTheDocument();
  });

  it("removes the context-menu expand entry while launch lock is active", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.contextMenu(screen.getByLabelText("Primary composition surface"));

    const menu = screen.getByRole("menu", { name: /stage actions/i });
    expect(within(menu).queryByRole("menuitem", { name: /^expand$/i })).not.toBeInTheDocument();
  });
});
