/**
 * TextPropertiesPanel rendering tests.
 * Verifies Create workflow controls that should stay visible in Character Mode.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("does not show credit estimation copy in the generate card", () => {
    render(
      <ComposeSendCard
        onGenerate={vi.fn()}
        costCredits={15}
        isGenerateDisabled={false}
        isPromptGenerating={false}
      />
    );

    expect(
      screen.queryByText("Estimated charges are billed in 5-credit increments.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Run generation with the current prompt and selections.")
    ).toBeInTheDocument();
  });

  it("shows character mode as step one in beginner mode", () => {
    const { container } = render(
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
        beginnerMode
        characterModeEnabled
      />
    );

    expect(screen.getByRole("group", { name: "Character mode section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable character mode" })).toBeInTheDocument();
    expect(
      screen.getByText("Toggle on character mode then select your character.")
    ).toBeInTheDocument();
    const stepBadges = Array.from(container.querySelectorAll(".step-badge")).map(
      (badge) => badge.textContent
    );
    expect(stepBadges).toEqual(["1", "2", "3"]);
  });

  it("allows opening the character picker in beginner mode", () => {
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
        beginnerMode
        characterModeEnabled
        characterOptions={[{ id: "char-1", name: "Avery Pulse" }]}
        selectedCharacterId="char-1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open character picker" }));
    expect(screen.getByRole("dialog", { name: "Choose character" })).toBeInTheDocument();
  });

  it("shows generate as step four in beginner mode", () => {
    const { container } = render(
      <ComposeSendCard
        onGenerate={vi.fn()}
        isGenerateDisabled={false}
        isPromptGenerating={false}
        beginnerMode
      />
    );

    const stepBadges = Array.from(container.querySelectorAll(".step-badge")).map(
      (badge) => badge.textContent
    );
    expect(stepBadges).toEqual(["4"]);
  });
});
