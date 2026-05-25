import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StandardCreatePropertiesPanel } from "../StandardCreatePropertiesPanel";

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

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const forwarded = { ...props };
    delete forwarded.unoptimized;
    return <div data-testid="mock-next-image" {...forwarded} />;
  },
}));

vi.mock("../StandardCreatePanelView", () => ({
  StandardCreatePanelView: ({
    createModeToggle,
    promptStepProps,
    onCreateModelOpen,
  }: {
    createModeToggle?: React.ReactNode;
    promptStepProps: {
      title?: string;
      hideChatModeToggle?: boolean;
      composerLeadingContent?: React.ReactNode;
    };
    onCreateModelOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
  }) => (
    <div data-testid="standard-create-panel-view">
      <span>{promptStepProps.title}</span>
      <span data-testid="chat-toggle-visibility">
        {promptStepProps.hideChatModeToggle ? "hidden" : "visible"}
      </span>
      <div data-testid="composer-leading-content">{promptStepProps.composerLeadingContent}</div>
      <button type="button" onClick={onCreateModelOpen}>
        open-model-picker
      </button>
      {createModeToggle}
    </div>
  ),
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
  getModelConfig: () => null,
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

  it("always renders the standard create panel view", () => {
    render(<StandardCreatePropertiesPanel {...baseProps} />);

    expect(screen.getByTestId("standard-create-panel-view")).toBeInTheDocument();
    expect(screen.getByText("Ask anything")).toBeInTheDocument();
    expect(screen.getByTestId("chat-toggle-visibility")).toHaveTextContent("visible");
    expect(
      within(screen.getByTestId("composer-leading-content")).getByRole("button", {
        name: "Generate",
      })
    ).toBeInTheDocument();
  });

  it("uses the inline-response generate prefab without button busy semantics in the composer row", () => {
    render(<StandardCreatePropertiesPanel {...baseProps} costCredits={2} isPromptGenerating />);

    const button = within(screen.getByTestId("composer-leading-content")).getByRole("button", {
      name: "Generate",
    });

    expect(button.classList.contains("agent-response-inline-generate-prefab")).toBe(true);
    expect(button).not.toHaveAttribute("aria-busy");
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
    expect(onModelPickerOpen.mock.calls[0]?.[2]).toBe("text-image");
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
