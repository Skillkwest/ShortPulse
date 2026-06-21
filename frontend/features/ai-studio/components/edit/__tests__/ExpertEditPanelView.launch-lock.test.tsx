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
  it("keeps the first secondary reference slot visible when its image is cleared", () => {
    const onExtraImageChange = vi.fn();
    render(
      <ExpertEditPanelView
        {...baseProps}
        extraImageUrls={["https://example.com/first-reference.png", null, null]}
        onExtraImageChange={onExtraImageChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove reference slot 1" }));

    expect(onExtraImageChange).toHaveBeenCalledWith(0, null);
    expect(screen.getByLabelText("Secondary edit image 1")).toBeInTheDocument();
  });

  it("starts with two secondary reference slots and can add or remove visible slots", () => {
    const onExtraImageChange = vi.fn();
    render(<ExpertEditPanelView {...baseProps} onExtraImageChange={onExtraImageChange} />);

    expect(
      screen.getByText("Add references for specific faces, products, or style details.")
    ).toBeInTheDocument();
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

  it("enters compact wrapped-reference layout when the second reference row appears", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const panel = screen.getByRole("group", { name: "Expert edit composer" });
    expect(panel).not.toHaveClass("has-wrapped-secondary-references");

    const addButton = screen.getByRole("button", { name: "Add reference slot" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    expect(screen.getByLabelText("Secondary edit image 5")).toBeInTheDocument();
    expect(panel).toHaveClass("has-wrapped-secondary-references");

    fireEvent.click(screen.getByRole("button", { name: "Remove reference slot 5" }));
    expect(panel).not.toHaveClass("has-wrapped-secondary-references");
  });

  it("hides non-standard edit mode UI while keeping move controls available", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    expect(screen.queryByText("Select Edit Mode")).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: /generation mode/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Inpaint action tools")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /undo move action/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redo move action/i })).toBeInTheDocument();
  });

  it("keeps Generate disabled until ready without showing a warning strip", () => {
    const { rerender } = render(<ExpertEditPanelView {...baseProps} referenceText="" />);

    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Describe what should change...")).toBeInTheDocument();
    expect(
      screen.queryByText("Describe what should change before generating.")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Expert edit composer" })).not.toHaveClass(
      "has-generate-guardrail"
    );

    rerender(<ExpertEditPanelView {...baseProps} referenceText="Clean up the image." />);

    expect(screen.getByRole("button", { name: "Generate" })).not.toBeDisabled();
    expect(
      screen.queryByText("Describe what should change before generating.")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Expert edit composer" })).not.toHaveClass(
      "has-generate-guardrail"
    );
  });

  it("guides empty primary image intake before editing can start", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl={null}
        referenceText="Clean up the image."
      />
    );

    expect(screen.getByText("Add an image to start editing.")).toBeInTheDocument();
    expect(screen.queryByText("Add a primary image before generating.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("removes the context-menu expand entry while launch lock is active", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.contextMenu(screen.getByLabelText("Primary composition surface"));

    const menu = screen.getByRole("menu", { name: /stage actions/i });
    expect(within(menu).queryByRole("menuitem", { name: /^expand$/i })).not.toBeInTheDocument();
  });
});
