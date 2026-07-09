import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StandardCreatePropertiesPanel } from "../StandardCreatePropertiesPanel";
import { resolveCreateComposerInlineGuardrailReason } from "../createComposerEmptyState";
import { KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID } from "../../../../../lib/model-runtime/providerModelIds";
import { AI_STUDIO_PLAN_CTA } from "../../../logic/generationAccessCta";

const { createCharacterModeControllerState } = vi.hoisted(() => ({
  createCharacterModeControllerState: {
    isCharacterPickerOpen: false,
    openCharacterPicker: vi.fn(),
    closeCharacterPicker: vi.fn(),
    handleCharacterModeEnabledToggle: vi.fn(),
    characterSelectDisabled: false,
    isCharacterSelectionEmpty: true,
    selectedCharacterName: "No Characters",
    selectedCharacterDisplayName: "No Characters",
    selectedCharacterProfileImageUrl: null as string | null,
    selectedCharacterInitials: null as string | null,
  },
}));

const { standardCreatePanelViewMockState } = vi.hoisted(() => ({
  standardCreatePanelViewMockState: {
    latestProps: null as null | Record<string, unknown>,
  },
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const forwarded = { ...props };
    delete forwarded.unoptimized;
    return <div data-testid="mock-next-image" {...forwarded} />;
  },
}));

vi.mock("../StandardCreatePanelView", () => ({
  StandardCreatePanelView: (
    props: {
      createModeToggle?: React.ReactNode;
      guardrailReason?: string | null;
      promptStepProps: {
        title?: string;
        hideChatModeToggle?: boolean;
        agentInputCollapseOnBlur?: boolean;
        agentInputVerticalExpansionAnchor?: "top" | "bottom";
        composerLeadingContent?: React.ReactNode;
        composerTrailingContent?: React.ReactNode;
        onChatModeEnabledChange?: (value: boolean) => void;
        onUseAssistantMessageAsPrompt?: (request: { messageId: string; prompt: string }) => void;
      };
      onCreateModelOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
      showCreateControlSet: boolean;
    } & Record<string, unknown>
  ) => {
    standardCreatePanelViewMockState.latestProps = props;
    const { createModeToggle, promptStepProps, onCreateModelOpen, showCreateControlSet } = props;
    return (
      <div data-testid="standard-create-panel-view">
        <span>{promptStepProps.title}</span>
        <span data-testid="chat-toggle-visibility">
          {promptStepProps.hideChatModeToggle ? "hidden" : "visible"}
        </span>
        <span data-testid="agent-input-collapse-on-blur">
          {String(Boolean(promptStepProps.agentInputCollapseOnBlur))}
        </span>
        <span data-testid="create-control-set-visibility">
          {showCreateControlSet ? "visible" : "hidden"}
        </span>
        {props.guardrailReason ? (
          <div className="create-composer-inline-warning-bubble" role="status">
            {props.guardrailReason}
          </div>
        ) : null}
        <div data-testid="composer-leading-content">{promptStepProps.composerLeadingContent}</div>
        <div data-testid="composer-trailing-content">{promptStepProps.composerTrailingContent}</div>
        <button type="button" onClick={onCreateModelOpen}>
          open-model-picker
        </button>
        {createModeToggle}
      </div>
    );
  },
}));

vi.mock("../../modal-layer/AiStudioModalLayer", () => ({
  AiStudioModalLayer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAiStudioModalActivity: () => false,
}));

vi.mock("../../../hooks/useAvatarResilience", () => ({
  useAvatarResilience: () => ({
    resolveAvatarUrl: (_id: string, url: string | null) => url,
    clearAvatarFailure: vi.fn(),
    handleAvatarError: vi.fn(async () => undefined),
  }),
}));

vi.mock("../../../logic/createSelectorState", () => ({
  deriveCreateSelectorViewState: () => ({
    imageResolutionOptions: [],
    imageResolutionValue: "model_default",
    shouldShowImageResolutionCard: false,
    isModelSelectionEmpty: false,
    isCreateModelPickerOpen: false,
  }),
}));

vi.mock("../../../logic/modelRegistry", () => ({
  getModelConfig: (modelId: string | null) => {
    if (modelId === KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID) {
      return {
        allowedAspects: ["auto", "9:16", "4:5", "1:1", "5:4", "16:9"],
      };
    }
    return null;
  },
}));

vi.mock("../useCreateCharacterModeController", async () => {
  const actual = await vi.importActual("../useCreateCharacterModeController");
  return {
    ...(actual as object),
    useCreateCharacterModeController: () => createCharacterModeControllerState,
  };
});

describe("StandardCreatePropertiesPanel single mode", () => {
  const baseProps = {
    mode: "image" as const,
    aspect: "9:16",
    modelId: "seedream",
    modelLabel: "Seedream 4.5 Edit",
    prompt: "a cinematic portrait",
    isModelModalOpen: false,
    modelModalAnchor: null,
    onAspectChange: vi.fn(),
    onModelPickerOpen: vi.fn(),
    onPromptChange: vi.fn(),
    onGenerate: vi.fn(),
    characterModeEnabled: false,
  };

  beforeEach(() => {
    standardCreatePanelViewMockState.latestProps = null;
    createCharacterModeControllerState.isCharacterPickerOpen = false;
    createCharacterModeControllerState.openCharacterPicker = vi.fn();
    createCharacterModeControllerState.closeCharacterPicker = vi.fn();
    createCharacterModeControllerState.handleCharacterModeEnabledToggle = vi.fn();
    createCharacterModeControllerState.characterSelectDisabled = false;
    createCharacterModeControllerState.isCharacterSelectionEmpty = true;
    createCharacterModeControllerState.selectedCharacterName = "No Characters";
    createCharacterModeControllerState.selectedCharacterDisplayName = "No Characters";
    createCharacterModeControllerState.selectedCharacterProfileImageUrl = null;
    createCharacterModeControllerState.selectedCharacterInitials = null;
  });

  it("hides confusing Kie GPT Image 2 portrait crop aspect options", () => {
    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        modelId={KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID}
        modelLabel="GPT Image 2 Edit (Kie)"
      />
    );

    const latestProps = standardCreatePanelViewMockState.latestProps;
    expect(latestProps).not.toBeNull();
    const aspectValues = (
      (latestProps?.aspectOptionsForModel as Array<{ value: string }> | undefined) ?? []
    ).map((option) => option.value);

    expect(aspectValues).toEqual(["auto", "9:16", "1:1", "16:9"]);
  });

  it("passes a compact model label into the selected Create model dropdown", () => {
    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        modelId="kie-ai/gpt-image-2-image-to-image"
        modelLabel="GPT Image 2 Edit (Kie)"
      />
    );

    expect(standardCreatePanelViewMockState.latestProps?.effectiveModelLabel).toBe("GPT Image 2");
  });

  it("always renders the standard create panel view", () => {
    render(<StandardCreatePropertiesPanel {...baseProps} costCredits={2} />);

    expect(screen.getByTestId("standard-create-panel-view")).toBeInTheDocument();
    expect(screen.getByText("Ask anything")).toBeInTheDocument();
    expect(screen.getByTestId("chat-toggle-visibility")).toHaveTextContent("visible");
    expect(screen.getByTestId("agent-input-collapse-on-blur")).toHaveTextContent("false");
    expect(
      (
        standardCreatePanelViewMockState.latestProps?.promptStepProps as
          | { agentInputVerticalExpansionAnchor?: "top" | "bottom" }
          | undefined
      )?.agentInputVerticalExpansionAnchor
    ).toBe("bottom");
    expect(screen.getByTestId("create-control-set-visibility")).toHaveTextContent("visible");
    expect(
      within(screen.getByTestId("composer-leading-content")).getByRole("button", {
        name: "Generate",
      })
    ).toBeInTheDocument();
  });

  it("replaces the generate button with the active plan CTA when generation access is gated", () => {
    const onGenerate = vi.fn();

    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        onGenerate={onGenerate}
        isGenerateDisabled
        generationAccessCta={AI_STUDIO_PLAN_CTA}
      />
    );

    const leadingContent = screen.getByTestId("composer-leading-content");
    const planCta = within(leadingContent).getByRole("link", {
      name: "View subscription plans",
    });
    expect(planCta).toHaveAttribute("href", "/pricing");
    expect(
      within(leadingContent).queryByRole("button", {
        name: "Generate",
      })
    ).toBeNull();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("reserves the generate slot without showing pending cost copy while generation access resolves", () => {
    const onGenerate = vi.fn();

    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        onGenerate={onGenerate}
        costCredits={null}
        generationAccessResolving
      />
    );

    const leadingContent = screen.getByTestId("composer-leading-content");
    expect(
      within(leadingContent).queryByRole("button", {
        name: "Generate",
      })
    ).toBeNull();
    expect(
      within(leadingContent).queryByRole("link", {
        name: "View subscription plans",
      })
    ).toBeNull();
    expect(within(leadingContent).queryByText("Cost pending")).toBeNull();
    expect(leadingContent.querySelector(".ai-generation-access-cta-placeholder")).not.toBeNull();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("hides the create control set and inline actions while chat mode is enabled", () => {
    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        chatModeEnabled
        agentInput="agent draft that should not expose pinning"
        onPinPromptReference={vi.fn()}
      />
    );

    expect(screen.getByTestId("create-control-set-visibility")).toHaveTextContent("hidden");
    expect(
      within(screen.getByTestId("composer-leading-content")).queryByRole("button", {
        name: "Generate",
      })
    ).toBeNull();
    expect(
      within(screen.getByTestId("composer-trailing-content")).queryByRole("button", {
        name: "Pin text reference to reference grid",
      })
    ).toBeNull();
  });

  it("pins the current Standard composer prompt as a text reference", () => {
    const onPinPromptReference = vi.fn();

    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        prompt="  a precise text reference  "
        onPinPromptReference={onPinPromptReference}
      />
    );

    fireEvent.click(
      within(screen.getByTestId("composer-trailing-content")).getByRole("button", {
        name: "Pin text reference to reference grid",
      })
    );

    expect(onPinPromptReference).toHaveBeenCalledWith("a precise text reference");
  });

  it("does not render the Standard composer pin button for an empty prompt", () => {
    render(
      <StandardCreatePropertiesPanel {...baseProps} prompt="   " onPinPromptReference={vi.fn()} />
    );

    expect(
      within(screen.getByTestId("composer-trailing-content")).queryByRole("button", {
        name: "Pin text reference to reference grid",
      })
    ).toBeNull();
  });

  it("moves assistant output into the Standard prompt composer without generating", () => {
    const onPromptChange = vi.fn();
    const onChatModeEnabledChange = vi.fn();
    const onGenerate = vi.fn();

    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        chatModeEnabled
        onPromptChange={onPromptChange}
        onChatModeEnabledChange={onChatModeEnabledChange}
        onGenerate={onGenerate}
      />
    );

    const promptStepProps = standardCreatePanelViewMockState.latestProps?.promptStepProps as {
      onUseAssistantMessageAsPrompt?: (request: { messageId: string; prompt: string }) => void;
    };

    promptStepProps.onUseAssistantMessageAsPrompt?.({
      messageId: "assistant-output-1",
      prompt: "  A clean generation-ready prompt.  ",
    });

    expect(onChatModeEnabledChange).toHaveBeenCalledWith(false);
    expect(onPromptChange).toHaveBeenCalledWith("A clean generation-ready prompt.");
    expect(onChatModeEnabledChange.mock.invocationCallOrder[0]).toBeLessThan(
      onPromptChange.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("does not retoggle chat mode when use-as-prompt runs with chat mode already off", () => {
    const onPromptChange = vi.fn();
    const onChatModeEnabledChange = vi.fn();

    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        chatModeEnabled={false}
        onPromptChange={onPromptChange}
        onChatModeEnabledChange={onChatModeEnabledChange}
      />
    );

    const promptStepProps = standardCreatePanelViewMockState.latestProps?.promptStepProps as {
      onUseAssistantMessageAsPrompt?: (request: { messageId: string; prompt: string }) => void;
    };

    promptStepProps.onUseAssistantMessageAsPrompt?.({
      messageId: "assistant-output-2",
      prompt: "Prompt stays put.",
    });

    expect(onChatModeEnabledChange).not.toHaveBeenCalled();
    expect(onPromptChange).toHaveBeenCalledWith("Prompt stays put.");
  });

  it("toggles the Standard create control set cleanly across chat mode changes", () => {
    const onStylesPanelToggle = vi.fn();
    const onModelPickerClose = vi.fn();
    createCharacterModeControllerState.isCharacterPickerOpen = true;

    const { rerender } = render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        onStylesPanelToggle={onStylesPanelToggle}
        onModelPickerClose={onModelPickerClose}
        isStylesPanelOpen
        isModelModalOpen
        modelModalAnchor="create-model"
      />
    );

    expect(screen.getByTestId("create-control-set-visibility")).toHaveTextContent("visible");
    expect(createCharacterModeControllerState.closeCharacterPicker).not.toHaveBeenCalled();
    expect(onStylesPanelToggle).not.toHaveBeenCalled();
    expect(onModelPickerClose).not.toHaveBeenCalled();

    rerender(
      <StandardCreatePropertiesPanel
        {...baseProps}
        chatModeEnabled
        onStylesPanelToggle={onStylesPanelToggle}
        onModelPickerClose={onModelPickerClose}
        isStylesPanelOpen
        isModelModalOpen
        modelModalAnchor="create-model"
      />
    );

    expect(screen.getByTestId("create-control-set-visibility")).toHaveTextContent("hidden");
    expect(createCharacterModeControllerState.closeCharacterPicker).toHaveBeenCalledTimes(1);
    expect(onStylesPanelToggle).toHaveBeenCalledTimes(1);
    expect(onModelPickerClose).toHaveBeenCalledTimes(1);

    rerender(
      <StandardCreatePropertiesPanel
        {...baseProps}
        onStylesPanelToggle={onStylesPanelToggle}
        onModelPickerClose={onModelPickerClose}
      />
    );

    expect(screen.getByTestId("create-control-set-visibility")).toHaveTextContent("visible");
  });

  it("uses the inline-response generate prefab without button busy semantics in the composer row", () => {
    render(<StandardCreatePropertiesPanel {...baseProps} costCredits={2} isPromptGenerating />);

    const button = within(screen.getByTestId("composer-leading-content")).getByRole("button", {
      name: "Generate",
    });

    expect(button.classList.contains("agent-response-inline-generate-prefab")).toBe(true);
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("suppresses pricing-unavailable inline helper copy in the create composer", () => {
    expect(
      resolveCreateComposerInlineGuardrailReason(
        "Pricing is unavailable for this configuration. Retry in a moment."
      )
    ).toBeNull();
  });

  it("suppresses describe-image inline helper copy in the create composer", () => {
    expect(
      resolveCreateComposerInlineGuardrailReason("Add or select an image to describe.")
    ).toBeNull();
  });

  it("keeps the create mode toggle in the standard panel path", () => {
    render(
      <StandardCreatePropertiesPanel {...baseProps} createModeToggle={<span>mode-toggle</span>} />
    );

    expect(screen.getByText("mode-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("standard-create-panel-view")).toBeInTheDocument();
  });

  it("keeps the standard create panel view when the legacy fallback path is gone", () => {
    render(<StandardCreatePropertiesPanel {...baseProps} />);

    expect(screen.getByTestId("standard-create-panel-view")).toBeInTheDocument();
  });

  it("opens the create picker with the text-image context", () => {
    const onModelPickerOpen = vi.fn();

    render(<StandardCreatePropertiesPanel {...baseProps} onModelPickerOpen={onModelPickerOpen} />);

    screen.getByRole("button", { name: "open-model-picker" }).click();

    expect(onModelPickerOpen).toHaveBeenCalledTimes(1);
    expect(onModelPickerOpen.mock.calls[0]?.[0]).toBe("create-model");
    expect(onModelPickerOpen.mock.calls[0]?.[2]).toBe("text-image");
  });

  it("opens the create picker with the text-image context in Character Mode", () => {
    const onModelPickerOpen = vi.fn();

    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        characterModeEnabled
        onModelPickerOpen={onModelPickerOpen}
      />
    );

    screen.getByRole("button", { name: "open-model-picker" }).click();

    expect(onModelPickerOpen).toHaveBeenCalledTimes(1);
    expect(onModelPickerOpen.mock.calls[0]?.[0]).toBe("create-model");
    expect(onModelPickerOpen.mock.calls[0]?.[2]).toBe("character-image");
  });

  it("closes hidden create-only surfaces while chat mode is on", () => {
    const onStylesPanelToggle = vi.fn();
    const onModelPickerClose = vi.fn();
    createCharacterModeControllerState.isCharacterPickerOpen = true;

    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        chatModeEnabled
        onStylesPanelToggle={onStylesPanelToggle}
        onModelPickerClose={onModelPickerClose}
        isStylesPanelOpen
        isModelModalOpen
        modelModalAnchor="create-model"
      />
    );

    expect(createCharacterModeControllerState.closeCharacterPicker).toHaveBeenCalledTimes(1);
    expect(onStylesPanelToggle).toHaveBeenCalledTimes(1);
    expect(onModelPickerClose).toHaveBeenCalledTimes(1);
  });

  it("renders the character picker modal with shared controls and preserves selection behavior", async () => {
    createCharacterModeControllerState.isCharacterPickerOpen = true;
    const onSelectedCharacterIdChange = vi.fn();
    const onCreateCharacter = vi.fn();

    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        characterModeEnabled
        characterOptions={[
          {
            id: "char-1",
            name: "Taylor",
            profileImageUrl: "https://example.com/taylor.png",
          },
        ]}
        selectedCharacterId="char-1"
        selectedCharacterLookId=""
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
        onCreateCharacter={onCreateCharacter}
        loadCharacterLookOptions={async () => [{ id: "look-1", label: "Studio", isDefault: true }]}
      />
    );

    expect(screen.getByRole("dialog", { name: "Choose character" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Create Character" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Create Character" }));
    expect(createCharacterModeControllerState.closeCharacterPicker).toHaveBeenCalledTimes(1);
    expect(onCreateCharacter).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText("Look: Studio")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /taylor/i }));
    expect(onSelectedCharacterIdChange).toHaveBeenCalledWith("char-1", "look-1");
  });
});
