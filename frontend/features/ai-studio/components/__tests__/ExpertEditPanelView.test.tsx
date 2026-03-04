import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExpertEditPanelView } from "../edit/ExpertEditPanelView";

vi.mock("next/image", () => ({
  default: (props: { alt?: string; [key: string]: unknown }) => {
    const forwarded = { ...props };
    delete forwarded.unoptimized;
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
});
