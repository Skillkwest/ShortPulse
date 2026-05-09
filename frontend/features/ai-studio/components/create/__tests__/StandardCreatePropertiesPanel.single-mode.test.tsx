import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StandardCreatePropertiesPanel } from "../StandardCreatePropertiesPanel";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <div data-testid="mock-next-image" {...props} />,
}));

vi.mock("../StandardCreatePanelView", () => ({
  StandardCreatePanelView: ({
    createModeToggle,
    promptStepProps,
    onCreateModelOpen,
  }: {
    createModeToggle?: React.ReactNode;
    promptStepProps: { title?: string; hideChatModeToggle?: boolean };
    onCreateModelOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
  }) => (
    <div data-testid="standard-create-panel-view">
      <span>{promptStepProps.title}</span>
      <span data-testid="chat-toggle-visibility">
        {promptStepProps.hideChatModeToggle ? "hidden" : "visible"}
      </span>
      <button type="button" onClick={onCreateModelOpen}>
        open-model-picker
      </button>
      {createModeToggle}
    </div>
  ),
}));

vi.mock("../BeginnerCreatePanelView", () => ({
  BeginnerCreatePanelView: () => <div data-testid="beginner-create-panel-view" />,
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
    disableOutputGenerate: false,
  }),
}));

vi.mock("../../../logic/modelRegistry", () => ({
  getModelConfig: () => null,
}));

vi.mock("../useCreateCharacterModeController", async () => {
  const actual = await vi.importActual("../useCreateCharacterModeController");
  return {
    ...(actual as object),
    useCreateCharacterModeController: () => ({
      characterStepSubtitle: "Select one of your Character Manager profiles.",
      isCharacterPickerOpen: false,
      openCharacterPicker: vi.fn(),
      closeCharacterPicker: vi.fn(),
      handleCharacterModeEnabledToggle: vi.fn(),
      characterSelectDisabled: false,
      isCharacterSelectionEmpty: true,
      selectedCharacterName: "No characters available",
      selectedCharacterDisplayName: "No characters available",
      selectedCharacterProfileImageUrl: null,
      selectedCharacterInitials: null,
    }),
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
    onChatOffInlineGenerate: vi.fn(),
    onSavePrompt: vi.fn(),
    characterModeEnabled: false,
  };

  it("always renders the standard create panel view", () => {
    render(<StandardCreatePropertiesPanel {...baseProps} expertCreateUiEligible={true} />);

    expect(screen.getByTestId("standard-create-panel-view")).toBeInTheDocument();
    expect(screen.getByText("Ask anything")).toBeInTheDocument();
    expect(screen.getByTestId("chat-toggle-visibility")).toHaveTextContent("visible");
  });

  it("keeps the create mode toggle in the standard panel path", () => {
    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        expertCreateUiEligible={true}
        createModeToggle={<span>mode-toggle</span>}
      />
    );

    expect(screen.getByText("mode-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("standard-create-panel-view")).toBeInTheDocument();
  });

  it("preserves the beginner create branch when expert create is not eligible", () => {
    render(<StandardCreatePropertiesPanel {...baseProps} expertCreateUiEligible={false} />);

    expect(screen.getByTestId("beginner-create-panel-view")).toBeInTheDocument();
    expect(screen.queryByTestId("standard-create-panel-view")).not.toBeInTheDocument();
  });

  it("opens the create picker with the text-image context", () => {
    const onModelPickerOpen = vi.fn();

    render(
      <StandardCreatePropertiesPanel
        {...baseProps}
        expertCreateUiEligible={true}
        onModelPickerOpen={onModelPickerOpen}
      />
    );

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
        expertCreateUiEligible={true}
        characterModeEnabled
        onModelPickerOpen={onModelPickerOpen}
      />
    );

    screen.getByRole("button", { name: "open-model-picker" }).click();

    expect(onModelPickerOpen).toHaveBeenCalledTimes(1);
    expect(onModelPickerOpen.mock.calls[0]?.[0]).toBe("create-model");
    expect(onModelPickerOpen.mock.calls[0]?.[2]).toBe("text-image");
  });
});
