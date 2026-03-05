import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExpertEditPanelView } from "../edit/ExpertEditPanelView";

vi.mock("next/image", () => ({
  default: (props: { alt?: string; [key: string]: unknown }) => {
    const forwarded = { ...props };
    delete forwarded.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt ?? ""} {...forwarded} />;
  },
}));

describe("ExpertEditPanelView", () => {
  const baseProps: React.ComponentProps<typeof ExpertEditPanelView> = {
    expertEditEligible: true,
    aspect: "1:1",
    modelId: "fal-ai/nano-banana/edit",
    modelLabel: "Nano Banana Edit",
    referenceImageUrl: null,
    extraImageUrls: [null, null, null],
    referenceText: "",
    imageResolution: "model_default",
    aspectOptions: [
      { value: "1:1", ratioLabel: "1:1", name: "Square", orientation: "square" },
      { value: "16:9", ratioLabel: "16:9", name: "Landscape", orientation: "horizontal" },
    ],
    isModelModalOpen: false,
    modelModalAnchor: null,
    onAspectChange: vi.fn(),
    onModelPickerOpen: vi.fn(),
    onPrimaryImageChange: vi.fn(),
    onExtraImageChange: vi.fn(),
    onPromptTextChange: vi.fn(),
    onRegenerate: vi.fn(),
    resolvePreviewUrlById: vi.fn(() => null),
    costCredits: 5,
    isGenerateDisabled: false,
    referenceImageWarning: null,
    onImageResolutionChange: vi.fn(),
    characterOptions: [],
    selectedCharacterId: "",
    onSelectedCharacterIdChange: vi.fn(),
    isCharacterOptionsLoading: false,
    characterModeEnabled: false,
    onCharacterModeEnabledChange: vi.fn(),
  };

  it("renders one primary and three secondary edit dropzones", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    expect(screen.getByLabelText("Primary edit image")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Secondary edit image 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Styles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Background" })).toBeInTheDocument();
  });

  it("enables Remove Background only when a primary image is loaded", () => {
    const { rerender } = render(<ExpertEditPanelView {...baseProps} referenceImageUrl={null} />);

    expect(screen.getByRole("button", { name: "Remove Background" })).toBeDisabled();

    rerender(
      <ExpertEditPanelView {...baseProps} referenceImageUrl="https://example.com/reference.png" />
    );

    expect(screen.getByRole("button", { name: "Remove Background" })).not.toBeDisabled();
  });

  it("disables inline generate until a primary image exists", () => {
    render(<ExpertEditPanelView {...baseProps} referenceImageUrl={null} />);

    const generateBtn = screen.getByRole("button", { name: /generate/i });
    expect(generateBtn).toBeDisabled();
  });

  it("keeps inline generate enabled with primary image even when prompt is empty", () => {
    render(
      <ExpertEditPanelView
        {...baseProps}
        referenceImageUrl="https://example.com/reference.png"
        referenceText=""
        isGenerateDisabled={false}
      />
    );

    const generateBtn = screen.getByRole("button", { name: /generate/i });
    expect(generateBtn).not.toBeDisabled();
  });

  it("does not render chat mode toggle in expert edit", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    expect(screen.queryByText("Chat Mode")).not.toBeInTheDocument();
  });

  it("switches selected inpaint mode button when clicked", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const lassoBtn = screen.getByRole("button", { name: /lasso/i });
    const brushBtn = screen.getByRole("button", { name: /brush/i });
    const autoBtn = screen.getByRole("button", { name: /auto/i });

    expect(brushBtn).toHaveAttribute("aria-pressed", "true");
    expect(lassoBtn).toHaveAttribute("aria-pressed", "false");
    expect(autoBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(lassoBtn);
    expect(lassoBtn).toHaveAttribute("aria-pressed", "true");
    expect(brushBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(autoBtn);
    expect(autoBtn).toHaveAttribute("aria-pressed", "true");
    expect(lassoBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("switches selection tabs between Select and Unselect", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const selectTab = screen.getByRole("tab", { name: /^select$/i });
    const unselectTab = screen.getByRole("tab", { name: /^unselect$/i });

    expect(selectTab).toHaveAttribute("aria-selected", "true");
    expect(unselectTab).toHaveAttribute("aria-selected", "false");

    fireEvent.click(unselectTab);
    expect(unselectTab).toHaveAttribute("aria-selected", "true");
    expect(selectTab).toHaveAttribute("aria-selected", "false");

    fireEvent.click(selectTab);
    expect(selectTab).toHaveAttribute("aria-selected", "true");
    expect(unselectTab).toHaveAttribute("aria-selected", "false");
  });

  it("collapses and expands inpaint controls from the skinny toggle button", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const collapseButton = screen.getByRole("button", { name: /collapse inpaint controls/i });
    expect(collapseButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("inpaint-collapse-icon-dots")).toBeInTheDocument();
    expect(screen.queryByTestId("inpaint-collapse-icon-brush")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Tools", { selector: ".edit-expert-inpaint-collapse-title" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^move$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^brush$/i })).toBeInTheDocument();

    fireEvent.click(collapseButton);
    expect(screen.getByRole("button", { name: /expand inpaint controls/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByTestId("inpaint-collapse-icon-brush")).toBeInTheDocument();
    expect(screen.queryByTestId("inpaint-collapse-icon-dots")).not.toBeInTheDocument();
    expect(
      screen.getByText("Tools", { selector: ".edit-expert-inpaint-collapse-title" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^move$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^brush$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand inpaint controls/i }));
    expect(screen.getByRole("button", { name: /collapse inpaint controls/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByTestId("inpaint-collapse-icon-dots")).toBeInTheDocument();
    expect(screen.queryByTestId("inpaint-collapse-icon-brush")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Tools", { selector: ".edit-expert-inpaint-collapse-title" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^move$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^brush$/i })).toBeInTheDocument();
  });

  it("adds new layers in sequential order when add layer is clicked", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    expect(screen.getByRole("button", { name: "layer 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "layer 2" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add layer/i }));
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add layer/i }));
    expect(screen.getByRole("button", { name: "layer 3" })).toBeInTheDocument();
  });

  it("deletes a layer and refreshes layer numbering", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /add layer/i }));
    fireEvent.click(screen.getByRole("button", { name: /add layer/i }));
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "layer 3" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete layer 2" }));
    expect(screen.queryByRole("button", { name: "layer 3" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "layer 2" })).toBeInTheDocument();
  });

  it("allows renaming a layer on double-click", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const layerOneButton = screen.getByRole("button", { name: "layer 1" });
    fireEvent.doubleClick(layerOneButton);

    const renameInput = screen.getByLabelText("Rename layer 1");
    fireEvent.change(renameInput, { target: { value: "HeroLayer" } });
    fireEvent.keyDown(renameInput, { key: "Enter", code: "Enter" });

    expect(screen.getByRole("button", { name: "HeroLayer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "layer 1" })).not.toBeInTheDocument();
  });

  it("allows selecting individual layers", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /add layer/i }));
    const layerOneButton = screen.getByRole("button", { name: "layer 1" });
    const layerTwoButton = screen.getByRole("button", { name: "layer 2" });

    expect(layerOneButton).toHaveClass("is-selected");
    expect(layerTwoButton).not.toHaveClass("is-selected");

    fireEvent.click(layerTwoButton);
    expect(layerTwoButton).toHaveClass("is-selected");
    expect(layerOneButton).not.toHaveClass("is-selected");
  });

  it("does not delete layer 1 and resets its name back to layer 1", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    const layerOneButton = screen.getByRole("button", { name: "layer 1" });
    fireEvent.doubleClick(layerOneButton);

    const renameInput = screen.getByLabelText("Rename layer 1");
    fireEvent.change(renameInput, { target: { value: "HeroLayer" } });
    fireEvent.keyDown(renameInput, { key: "Enter", code: "Enter" });

    expect(screen.getByRole("button", { name: "HeroLayer" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete HeroLayer" }));

    expect(screen.getByRole("button", { name: "layer 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "HeroLayer" })).not.toBeInTheDocument();
  });

  it("hides add layer button at 10 layers and shows it again after deletion", () => {
    render(<ExpertEditPanelView {...baseProps} />);

    for (let i = 0; i < 9; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: /add layer/i }));
    }

    expect(screen.getByRole("button", { name: "layer 10" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add layer/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete layer 10" }));
    expect(screen.getByRole("button", { name: /add layer/i })).toBeInTheDocument();
  });
});
