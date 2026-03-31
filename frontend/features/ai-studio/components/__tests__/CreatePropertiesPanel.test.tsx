/**
 * CreatePropertiesPanel rendering tests.
 * Verifies Create workflow controls that should stay visible in Character Mode.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComposeSendCard, CreatePropertiesPanel } from "../CreatePropertiesPanel";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...imageProps} alt={props.alt ?? ""} />;
  },
}));

describe("CreatePropertiesPanel", () => {
  const baseProps: React.ComponentProps<typeof CreatePropertiesPanel> = {
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
    onChatOffInlineGenerate: vi.fn(),
    onSavePrompt: vi.fn(),
  };

  const renderPanel = (
    overrides: Partial<React.ComponentProps<typeof CreatePropertiesPanel>> = {}
  ) => render(<CreatePropertiesPanel {...baseProps} {...overrides} />);

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

  it("refreshes character options when opening the character picker", async () => {
    const refreshCharacterOptions = vi.fn(async () => []);
    renderPanel({
      beginnerMode: true,
      characterModeEnabled: true,
      characterOptions: [{ id: "char-1", name: "Avery Pulse" }],
      selectedCharacterId: "char-1",
      refreshCharacterOptions,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open character picker" }));
    await waitFor(() => {
      expect(refreshCharacterOptions).toHaveBeenCalled();
    });
  });

  it("keeps the picker openable when character mode is on and options are empty", () => {
    renderPanel({
      beginnerMode: true,
      characterModeEnabled: true,
      characterOptions: [],
      selectedCharacterId: "",
      isCharacterOptionsLoading: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open character picker" }));
    expect(screen.getByRole("dialog", { name: "Choose character" })).toBeInTheDocument();
    expect(screen.getByText("No character profiles available.")).toBeInTheDocument();
  });

  it("shows loading state in the picker when character options are loading", () => {
    renderPanel({
      beginnerMode: true,
      characterModeEnabled: true,
      characterOptions: [],
      selectedCharacterId: "",
      isCharacterOptionsLoading: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open character picker" }));
    expect(screen.getByText("Loading character profiles...")).toBeInTheDocument();
  });

  it("shows a retry action when picker refresh fails", async () => {
    const refreshCharacterOptions = vi
      .fn<() => Promise<Array<{ id: string; name: string; profileImageUrl: string | null }>>>()
      .mockRejectedValueOnce(new Error("refresh-open-failure-1"))
      .mockRejectedValueOnce(new Error("refresh-open-failure-2"))
      .mockResolvedValueOnce([]);
    renderPanel({
      beginnerMode: true,
      characterModeEnabled: true,
      characterOptions: [],
      selectedCharacterId: "",
      refreshCharacterOptions,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open character picker" }));
    await waitFor(() => {
      expect(screen.getByText("Unable to refresh character profiles.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(refreshCharacterOptions).toHaveBeenCalledTimes(3);
    });
  });

  it("falls back to initials for broken picker-list avatars", () => {
    renderPanel({
      beginnerMode: true,
      characterModeEnabled: true,
      characterOptions: [{ id: "char-1", name: "Avery Pulse", profileImageUrl: "broken-avatar" }],
      selectedCharacterId: "char-1",
    });

    fireEvent.click(screen.getByRole("button", { name: "Open character picker" }));
    const listAvatar = document.querySelector(
      ".ai-character-list-avatar-image"
    ) as HTMLImageElement | null;
    expect(listAvatar).not.toBeNull();
    if (!listAvatar) return;
    fireEvent.error(listAvatar);

    expect(document.querySelector(".ai-character-list-avatar-initials")?.textContent).toBe("AP");
  });

  it("recovers broken trigger avatars after one refresh pass", async () => {
    let refreshedAvatarUrl: string | null = "broken-avatar";
    const refreshCharacterOptions = vi.fn(async () => {
      refreshedAvatarUrl = "https://cdn.test/recovered-avatar.png";
      return [
        {
          id: "char-1",
          name: "Taylor",
          profileImageUrl: refreshedAvatarUrl,
        },
      ];
    });
    const resolveCharacterAvatarUrlById = vi.fn((characterId: string | null | undefined) =>
      characterId === "char-1" ? refreshedAvatarUrl : null
    );
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      characterModeEnabled: true,
      characterOptions: [{ id: "char-1", name: "Taylor", profileImageUrl: "broken-avatar" }],
      selectedCharacterId: "char-1",
      refreshCharacterOptions,
      resolveCharacterAvatarUrlById,
    });

    const triggerAvatar = screen.getByAltText("Taylor profile");
    fireEvent.error(triggerAvatar);

    await waitFor(() => {
      expect(screen.getByAltText("Taylor profile").getAttribute("src")).toBe(
        "https://cdn.test/recovered-avatar.png"
      );
    });
    expect(refreshCharacterOptions).toHaveBeenCalledTimes(1);
  });

  it("renders expert create composer only when expert UI is eligible and beginner mode is off", () => {
    const { rerender } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
    });
    expect(screen.getByRole("group", { name: "Expert create composer" })).toBeInTheDocument();

    rerender(<CreatePropertiesPanel {...baseProps} beginnerMode expertCreateUiEligible />);
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
      <CreatePropertiesPanel
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

  it("uses explicit no-history centered layout in expert create mode", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      agentMessages: [],
      stagedPrompt: null,
    });

    expect(container.querySelector(".create-expert-empty-state-shell")).toBeTruthy();
    expect(container.querySelector(".create-expert-empty-top-spacer")).toBeFalsy();
    expect(container.querySelector(".create-expert-chat-spacer")).toBeTruthy();
    expect(screen.queryByText("References attach from the message bar.")).not.toBeInTheDocument();
    expect(screen.queryByText("Send your next instruction.")).not.toBeInTheDocument();
  });

  it("renders the shared styles control in expert create and toggles via callback", () => {
    const onStylesPanelToggle = vi.fn();
    const { rerender } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      isStylesPanelOpen: false,
      onStylesPanelToggle,
    });

    const stylesButton = screen.getByRole("button", { name: "Styles" });
    expect(stylesButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(stylesButton);
    expect(onStylesPanelToggle).toHaveBeenCalledTimes(1);

    rerender(
      <CreatePropertiesPanel
        {...baseProps}
        beginnerMode={false}
        expertCreateUiEligible
        agentEnabled
        onAgentInputChange={vi.fn()}
        onAgentSend={vi.fn()}
        isStylesPanelOpen
        onStylesPanelToggle={onStylesPanelToggle}
      />
    );

    const openStylesButton = screen.getByRole("button", { name: "Styles" });
    expect(openStylesButton).toHaveAttribute("aria-expanded", "true");
    expect(openStylesButton).toHaveClass("is-open");
    expect(openStylesButton.closest(".edit-expert-styles-wrapper")).toHaveClass("is-open");
  });

  it("shows selected style preview in the expert create styles button", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      selectedStyleId: "cinematic",
    });

    const stylesButton = screen.getByRole("button", { name: "Styles" });
    expect(stylesButton).toHaveClass("has-selected-style");
    const preview = stylesButton.querySelector(
      ".edit-expert-styles-btn-preview"
    ) as HTMLSpanElement | null;
    expect(preview).toBeTruthy();
    expect(preview?.style.backgroundImage).toContain("/Styles/Cinematic.png");
  });

  it("shows selected custom style preview from the live styles catalog", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      selectedStyleId: "style-library-custom-1",
      stylesCatalog: [
        {
          id: "style-library-custom-1",
          title: "Noir Bloom",
          style: "Noir Bloom",
          referenceImageName: "Noir Bloom",
          stylePrompt: "cinematic editorial photography style, dramatic moody lighting",
          previewUrl: "https://demo.supabase.co/storage/v1/object/sign/media/noir.jpg",
          placeholder: false,
        },
      ],
    });

    const stylesButton = screen.getByRole("button", { name: "Styles" });
    expect(stylesButton).toHaveClass("has-selected-style");
    const preview = stylesButton.querySelector(
      ".edit-expert-styles-btn-preview"
    ) as HTMLSpanElement | null;
    expect(preview).toBeTruthy();
    expect(preview?.style.backgroundImage).toContain("https://demo.supabase.co/storage");
  });

  it("does not render a clear-style hover button in expert create styles control", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      selectedStyleId: "cinematic",
    });

    expect(screen.queryByRole("button", { name: "Clear selected style" })).not.toBeInTheDocument();
  });

  it("hides input-bar attachment guidance in expert mode once chat history exists", () => {
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

    expect(screen.queryByText("References attach from the message bar.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Drag & drop reference cards here to attach context.")
    ).not.toBeInTheDocument();
  });

  it("renders attached references in the expert input shell instead of chat history", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      stagedAttachments: [
        {
          id: "prompt-ref-1",
          kind: "prompt",
          text: "Dropped reference prompt.",
          referenceId: "ref-1",
        },
      ],
      agentMessages: [],
      stagedPrompt: null,
    });

    expect(screen.getByText("What do you want to make?")).toBeInTheDocument();
    expect(screen.queryByText("Send your next instruction.")).not.toBeInTheDocument();
    expect(
      container.querySelector(
        ".agent-composer-input-shell .agent-composer-attachment-strip .agent-attachment-card-list--composer"
      )
    ).toBeTruthy();
    expect(container.querySelector(".agent-chat-surface .agent-user-attachments")).toBeNull();
  });

  it("routes both expert generate buttons to the same handler and mirrors disabled state", () => {
    const onGenerate = vi.fn();
    const renderExpertWithComposeCard = (
      overrides: Partial<React.ComponentProps<typeof CreatePropertiesPanel>> = {}
    ) =>
      render(
        <>
          <CreatePropertiesPanel
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
        <CreatePropertiesPanel
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

  it("keeps the expert inline generate button bound to onGenerate", () => {
    const onGenerate = vi.fn();
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      onGenerate,
      characterModeEnabled: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("shows chat-off inline generate in expert mode and keeps it wired to onChatOffInlineGenerate", () => {
    const onChatOffInlineGenerate = vi.fn();
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      chatModeEnabled: false,
      agentInput: "Refine this prompt for cinematic lighting.",
      onChatOffInlineGenerate,
      characterModeEnabled: false,
    });

    const button = screen.getByRole("button", { name: "Generate with current prompt" });
    expect(button).toHaveClass("agent-response-inline-generate-prefab");
    fireEvent.click(button);
    expect(onChatOffInlineGenerate).toHaveBeenCalledTimes(1);
  });

  it("keeps beginner chat-off inline generate on legacy markup", () => {
    renderPanel({
      beginnerMode: true,
      agentEnabled: true,
      chatModeEnabled: false,
      agentInput: "Legacy beginner prompt",
      onChatOffInlineGenerate: vi.fn(),
    });

    const button = screen.getByRole("button", { name: "Generate with current prompt" });
    expect(button).not.toHaveClass("agent-response-inline-generate-prefab");
  });

  it("disables chat-off inline generate when create generate is disabled", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      chatModeEnabled: false,
      agentInput: "A valid prompt should still be blocked when create is disabled.",
      onGenerate: vi.fn(),
      onChatOffInlineGenerate: vi.fn(),
      characterModeEnabled: false,
      isGenerateDisabled: true,
      isChatOffInlineGenerateDisabled: true,
    });

    expect(screen.getByRole("button", { name: "Generate with current prompt" })).toBeDisabled();
  });

  it("keeps chat-off inline generate enabled when only the transient click lock is active", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      chatModeEnabled: false,
      agentInput: "Allow immediate re-clicks for the inline generate button.",
      onGenerate: vi.fn(),
      onChatOffInlineGenerate: vi.fn(),
      characterModeEnabled: false,
      isGenerateDisabled: true,
      isChatOffInlineGenerateDisabled: false,
    });

    expect(screen.getByRole("button", { name: "Generate with current prompt" })).toBeEnabled();
  });

  it("keeps chat-off inline generate enabled while a generation submit is in flight", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      chatModeEnabled: false,
      agentInput: "Keep the inline button active during submit.",
      onGenerate: vi.fn(),
      onChatOffInlineGenerate: vi.fn(),
      characterModeEnabled: false,
      isPromptGenerating: true,
      isChatOffInlineGenerateDisabled: false,
    });

    expect(screen.getByRole("button", { name: "Generate with current prompt" })).toBeEnabled();
  });

  it("disables chat-off inline generate when both prompt sources are empty", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      chatModeEnabled: false,
      prompt: "",
      agentInput: "",
      onGenerate: vi.fn(),
      onChatOffInlineGenerate: vi.fn(),
      characterModeEnabled: false,
      isGenerateDisabled: false,
    });

    expect(screen.getByRole("button", { name: "Generate with current prompt" })).toBeDisabled();
  });

  it("keeps chat-off inline generate enabled when the shared prompt can still be used", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      chatModeEnabled: false,
      prompt: "Use the shared prompt fallback for this inline generate.",
      agentInput: "",
      onGenerate: vi.fn(),
      onChatOffInlineGenerate: vi.fn(),
      characterModeEnabled: false,
      isGenerateDisabled: false,
    });

    expect(screen.getByRole("button", { name: "Generate with current prompt" })).toBeEnabled();
  });

  it("shows estimated cost on chat-off inline generate", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      chatModeEnabled: false,
      onGenerate: vi.fn(),
      onChatOffInlineGenerate: vi.fn(),
      characterModeEnabled: false,
      outputGenerateCostCredits: 1234,
    });

    expect(screen.getByRole("button", { name: "Generate with current prompt" })).toHaveTextContent(
      "1,234"
    );
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

  it("keeps the expert model selector visible in character mode and preserves selected model when toggled off", () => {
    const onCharacterModeEnabledChange = vi.fn();
    const onModelPickerOpen = vi.fn();
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      characterModeEnabled: true,
      onCharacterModeEnabledChange,
      onModelPickerOpen,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open model picker" }));
    expect(onModelPickerOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Disable character mode" }));
    expect(onCharacterModeEnabledChange).toHaveBeenCalledWith(false);
  });

  it("keeps the selected model label visible while character mode is enabled", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      characterModeEnabled: true,
      modelLabel: "Seedream 4.5 Edit",
    });

    const modelPickerButton = screen.getByRole("button", { name: "Open model picker" });
    expect(modelPickerButton).toHaveTextContent("Seedream 4.5 Edit");
    expect(modelPickerButton).not.toHaveTextContent("Pulse Character");
  });

  it("resets character picker open state when character mode is toggled off then on", () => {
    const { rerender } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      characterModeEnabled: true,
      characterOptions: [{ id: "char-1", name: "Avery Pulse" }],
      selectedCharacterId: "char-1",
    });

    fireEvent.click(screen.getByRole("button", { name: "Open character picker" }));
    expect(screen.getByRole("dialog", { name: "Choose character" })).toBeInTheDocument();

    rerender(
      <CreatePropertiesPanel
        {...baseProps}
        beginnerMode={false}
        expertCreateUiEligible
        characterModeEnabled={false}
        characterOptions={[{ id: "char-1", name: "Avery Pulse" }]}
        selectedCharacterId="char-1"
      />
    );
    expect(screen.queryByRole("dialog", { name: "Choose character" })).not.toBeInTheDocument();

    rerender(
      <CreatePropertiesPanel
        {...baseProps}
        beginnerMode={false}
        expertCreateUiEligible
        characterModeEnabled
        characterOptions={[{ id: "char-1", name: "Avery Pulse" }]}
        selectedCharacterId="char-1"
      />
    );
    expect(screen.queryByRole("dialog", { name: "Choose character" })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Image resolution" }));
    fireEvent.click(screen.getByRole("option", { name: "2K" }));
    expect(onImageResolutionChange).toHaveBeenCalledWith("auto_2K");
  });

  it("disables expert output-generate pills when character mode is on without a selected character", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      characterModeEnabled: true,
      selectedCharacterId: "",
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
    });

    expect(screen.getByRole("button", { name: "Generate from this agent output" })).toBeDisabled();
  });

  it("disables expert output-generate pills when character mode is on and no model is selected", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      characterModeEnabled: true,
      selectedCharacterId: "char-1",
      modelId: null,
      modelLabel: "Choose Model",
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
    });

    expect(screen.getByRole("button", { name: "Generate from this agent output" })).toBeDisabled();
  });

  it("disables beginner output-generate pills when primary generate is disabled", () => {
    renderPanel({
      beginnerMode: true,
      agentEnabled: true,
      characterModeEnabled: false,
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      isGenerateDisabled: true,
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
    });

    expect(screen.getByRole("button", { name: "Generate from this agent output" })).toBeDisabled();
  });

  it("disables expert output-generate pills when character mode is off without a selected model", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      characterModeEnabled: false,
      modelId: null,
      modelLabel: "Choose Model",
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
    });

    expect(screen.getByRole("button", { name: "Generate from this agent output" })).toBeDisabled();
  });

  it("disables expert output-generate pills when credits are insufficient", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      characterModeEnabled: false,
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      hasSufficientCreditsForOutputGenerate: false,
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
    });

    expect(screen.getByRole("button", { name: "Generate from this agent output" })).toBeDisabled();
  });

  it("disables expert output-generate pills when primary generate is disabled", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      characterModeEnabled: false,
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      isGenerateDisabled: true,
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
    });

    expect(screen.getByRole("button", { name: "Generate from this agent output" })).toBeDisabled();
  });

  it("keeps expert output-generate pills enabled while media generation is in flight", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      characterModeEnabled: false,
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      isPromptGenerating: true,
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
    });

    expect(screen.getByRole("button", { name: "Generate from this agent output" })).toBeEnabled();
    expect(
      container.querySelector(".agent-messages .agent-message.agent-thinking-message")
    ).toBeNull();
    expect(screen.queryByText("Thinking…")).toBeNull();
  });

  it("keeps expert output-generate pills enabled in prompt-only text mode when selectors are valid", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      mode: "text",
      agentEnabled: true,
      characterModeEnabled: false,
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
    });

    expect(screen.getByRole("button", { name: "Generate from this agent output" })).toBeEnabled();
  });

  it("shows estimated output-generate cost on expert agent responses", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      characterModeEnabled: false,
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      outputGenerateCostCredits: 1234,
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
    });

    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("routes inline output generate to the provided prompt callback", () => {
    const onGenerateFromAgentOutputPrompt = vi.fn();
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      characterModeEnabled: false,
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      onGenerateFromAgentOutputPrompt,
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate from this agent output" }));
    expect(onGenerateFromAgentOutputPrompt).toHaveBeenCalledWith({
      messageId: "assistant-1",
      prompt: "Here is a revised prompt.",
      source: "history",
    });
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
