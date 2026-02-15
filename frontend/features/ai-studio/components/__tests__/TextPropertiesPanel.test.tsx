/**
 * TextPropertiesPanel rendering tests.
 * Verifies Create workflow controls that should stay visible in Character Mode.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComposeSendCard, TextPropertiesPanel } from "../TextPropertiesPanel";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...imageProps} alt={props.alt ?? ""} />;
  },
}));

describe("TextPropertiesPanel", () => {
  it("shows image resolution controls in character mode for Seedream edit", () => {
    render(
      <TextPropertiesPanel
        mode="image"
        aspect="9:16"
        modelId="fal-ai/bytedance/seedream/v4.5/edit"
        modelLabel="Seedream 4.5 Edit"
        prompt="Create a portrait"
        promptRef={{ current: null }}
        useReferenceImageIndicator={false}
        hasReferencePreview={false}
        isModelModalOpen={false}
        modelModalAnchor={null}
        onAspectChange={vi.fn()}
        onModelPickerOpen={vi.fn()}
        onPromptChange={vi.fn()}
        onToggleReferenceIndicator={vi.fn()}
        onGenerate={vi.fn()}
        onSavePrompt={vi.fn()}
        imageResolution="model_default"
        onImageResolutionChange={vi.fn()}
        characterModeEnabled
        beginnerMode={false}
      />
    );

    expect(
      screen.getByRole("group", {
        name: "Choose image resolution section",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Image resolution" })).toBeInTheDocument();
  });

  it("shows 5-credit rounding guidance in the generate card", () => {
    render(
      <ComposeSendCard
        onGenerate={vi.fn()}
        costCredits={15}
        isGenerateDisabled={false}
        isPromptGenerating={false}
      />
    );

    expect(
      screen.getByText("Estimated charges are billed in 5-credit increments.")
    ).toBeInTheDocument();
  });
});
