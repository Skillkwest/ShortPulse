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
  const baseProps: React.ComponentProps<typeof TextPropertiesPanel> = {
    mode: "image",
    aspect: "9:16",
    modelId: "fal-ai/bytedance/seedream/v4.5/edit",
    modelLabel: "Seedream 4.5 Edit",
    prompt: "Create a portrait",
    promptRef: { current: null },
    useReferenceImageIndicator: false,
    hasReferencePreview: false,
    isModelModalOpen: false,
    modelModalAnchor: null,
    onAspectChange: vi.fn(),
    onModelPickerOpen: vi.fn(),
    onPromptChange: vi.fn(),
    onToggleReferenceIndicator: vi.fn(),
    onGenerate: vi.fn(),
    onSavePrompt: vi.fn(),
  };

  const renderPanel = (overrides: Partial<React.ComponentProps<typeof TextPropertiesPanel>> = {}) =>
    render(<TextPropertiesPanel {...baseProps} {...overrides} />);

  it("shows image resolution controls in character mode for Seedream edit", () => {
    renderPanel({
      imageResolution: "model_default",
      onImageResolutionChange: vi.fn(),
      characterModeEnabled: true,
      beginnerMode: false,
    });

    expect(
      screen.getByRole("group", {
        name: "Choose image resolution section",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Image resolution" })).toBeInTheDocument();
  });

  it("shows neutral generate helper copy in the generate card", () => {
    render(
      <ComposeSendCard
        onGenerate={vi.fn()}
        costCredits={15}
        isGenerateDisabled={false}
        isPromptGenerating={false}
      />
    );

    expect(
      screen.getByText("Run generation with the current prompt and selections.")
    ).toBeInTheDocument();
  });

  it("shows character mode as step one in beginner mode", () => {
    const { container } = renderPanel({
      beginnerMode: true,
      characterModeEnabled: true,
    });

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
    renderPanel({
      beginnerMode: true,
      characterModeEnabled: true,
      characterOptions: [{ id: "char-1", name: "Avery Pulse" }],
      selectedCharacterId: "char-1",
    });

    fireEvent.click(screen.getByRole("button", { name: "Open character picker" }));
    expect(screen.getByRole("dialog", { name: "Choose character" })).toBeInTheDocument();
  });

  it("renders expert create composer only when expert UI is eligible and beginner mode is off", () => {
    const { rerender } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
    });
    expect(screen.getByRole("group", { name: "Expert create composer" })).toBeInTheDocument();

    rerender(<TextPropertiesPanel {...baseProps} beginnerMode expertCreateUiEligible />);
    expect(screen.queryByRole("group", { name: "Expert create composer" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Character mode section" })).toBeInTheDocument();
  });

  it("shows the expert title only before chat history exists", () => {
    const { rerender } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentMessages: [],
      stagedPrompt: null,
    });
    expect(screen.getByText("What do you want to make?")).toBeInTheDocument();

    rerender(
      <TextPropertiesPanel
        {...baseProps}
        beginnerMode={false}
        expertCreateUiEligible
        agentMessages={[
          {
            id: "assistant-1",
            role: "assistant",
            content: "Here is a revised prompt.",
          },
        ]}
      />
    );
    expect(screen.queryByText("What do you want to make?")).not.toBeInTheDocument();
  });

  it("uses explicit no-history spacer layout in expert create mode", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      agentMessages: [],
      stagedPrompt: null,
    });

    expect(container.querySelector(".create-expert-empty-top-spacer")).toBeTruthy();
    expect(container.querySelector(".create-expert-chat-spacer")).toBeTruthy();
    expect(screen.queryByText("References attach from the message bar.")).not.toBeInTheDocument();
    expect(screen.queryByText("Send your next instruction.")).not.toBeInTheDocument();
  });

  it("shows input-bar attachment guidance in expert mode once chat history exists", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
      stagedPrompt: null,
    });

    expect(screen.getByText("References attach from the message bar.")).toBeInTheDocument();
    expect(
      screen.queryByText("Drag & drop reference cards here to attach context.")
    ).not.toBeInTheDocument();
  });

  it("routes both expert generate buttons to the same handler and mirrors disabled state", () => {
    const onGenerate = vi.fn();
    const renderExpertWithComposeCard = (
      overrides: Partial<React.ComponentProps<typeof TextPropertiesPanel>> = {}
    ) =>
      render(
        <>
          <TextPropertiesPanel
            {...baseProps}
            beginnerMode={false}
            expertCreateUiEligible
            onGenerate={onGenerate}
            characterModeEnabled={false}
            {...overrides}
          />
          <ComposeSendCard
            onGenerate={onGenerate}
            costCredits={baseProps.costCredits}
            isGenerateDisabled={Boolean(overrides.isGenerateDisabled)}
            isPromptGenerating={Boolean(overrides.isPromptGenerating)}
            beginnerMode={false}
          />
        </>
      );

    const { rerender } = renderExpertWithComposeCard();

    const buttons = screen.getAllByRole("button", { name: "Generate" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(onGenerate).toHaveBeenCalledTimes(2);
    expect(buttons.every((button) => !button.hasAttribute("disabled"))).toBe(true);

    rerender(
      <>
        <TextPropertiesPanel
          {...baseProps}
          beginnerMode={false}
          expertCreateUiEligible
          onGenerate={onGenerate}
          characterModeEnabled={false}
          isGenerateDisabled
        />
        <ComposeSendCard
          onGenerate={onGenerate}
          isGenerateDisabled
          isPromptGenerating={false}
          beginnerMode={false}
        />
      </>
    );
    expect(
      screen
        .getAllByRole("button", { name: "Generate" })
        .every((button) => button.hasAttribute("disabled"))
    ).toBe(true);
  });

  it("keeps expert character picker selection wiring intact", () => {
    const onSelectedCharacterIdChange = vi.fn();
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      characterModeEnabled: true,
      characterOptions: [
        { id: "char-1", name: "Avery Pulse" },
        { id: "char-2", name: "Riley Vector" },
      ],
      selectedCharacterId: "char-1",
      onSelectedCharacterIdChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open character picker" }));
    fireEvent.click(screen.getByRole("button", { name: /Riley Vector/i }));
    expect(onSelectedCharacterIdChange).toHaveBeenCalledWith("char-2");
  });

  it("hides the expert model selector in character mode and clears model when toggled off", () => {
    const onCharacterModeEnabledChange = vi.fn();
    const onModelIdChange = vi.fn();
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      characterModeEnabled: true,
      onCharacterModeEnabledChange,
      onModelIdChange,
    });

    expect(screen.queryByRole("button", { name: "Open model picker" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Disable character mode" }));
    expect(onModelIdChange).toHaveBeenCalledWith(null);
    expect(onCharacterModeEnabledChange).toHaveBeenCalledWith(false);
  });

  it("keeps expert model, aspect, and resolution callbacks wired to existing handlers", () => {
    const onModelPickerOpen = vi.fn();
    const onAspectChange = vi.fn();
    const onImageResolutionChange = vi.fn();
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      characterModeEnabled: false,
      onModelPickerOpen,
      onAspectChange,
      onImageResolutionChange,
      imageResolution: "model_default",
    });

    fireEvent.click(screen.getByRole("button", { name: "Open model picker" }));
    expect(onModelPickerOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /9:16/i }));
    fireEvent.click(screen.getByRole("option", { name: /1:1/i }));
    expect(onAspectChange).toHaveBeenCalledWith("1:1");

    fireEvent.change(screen.getByRole("combobox", { name: "Image resolution" }), {
      target: { value: "auto_2K" },
    });
    expect(onImageResolutionChange).toHaveBeenCalledWith("auto_2K");
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
