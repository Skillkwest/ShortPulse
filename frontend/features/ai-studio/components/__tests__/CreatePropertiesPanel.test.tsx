/**
 * CreatePropertiesPanel rendering tests.
 * Verifies Create workflow controls that should stay visible in Character Mode.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
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
  it("keeps Standard and Pulse expert panel modules from importing each other's owned surfaces", () => {
    const standardSource = readFileSync(
      path.join(process.cwd(), "features/ai-studio/components/create/StandardCreatePanelView.tsx"),
      "utf8"
    );
    const pulseSource = readFileSync(
      path.join(process.cwd(), "features/ai-studio/components/create/PulseCreatePanelView.tsx"),
      "utf8"
    );

    expect(standardSource).not.toContain("CreateExpertPresetPanel");
    expect(standardSource).not.toContain("createPulsePresets");
    expect(standardSource).not.toContain("AgentPulseWorkflowSession");
    expect(pulseSource).not.toContain("AspectDropdown");
    expect(pulseSource).not.toContain("ResolutionDropdown");
  });

  it("keeps Standard chat surface out of Pulse workflow presentation", () => {
    const standardChatSurface = readFileSync(
      path.join(
        process.cwd(),
        "features/ai-studio/components/promptStep/PromptStepChatSurface.tsx"
      ),
      "utf8"
    );
    const pulseChatSurface = readFileSync(
      path.join(
        process.cwd(),
        "features/ai-studio/components/promptStep/PulsePromptStepChatSurface.tsx"
      ),
      "utf8"
    );

    expect(standardChatSurface).not.toContain("PromptStepPulseLoadingState");
    expect(standardChatSurface).not.toContain("pulseLoadingState");
    expect(standardChatSurface).not.toContain("useFlowComposerLayout");
    expect(pulseChatSurface).toContain("PromptStepPulseLoadingState");
    expect(pulseChatSurface).toContain("pulseLoadingState");
    expect(pulseChatSurface).toContain("useFlowComposerLayout");
  });

  const baseProps: React.ComponentProps<typeof CreatePropertiesPanel> = {
    mode: "image",
    aspect: "9:16",
    modelId: "fal-ai/bytedance/seedream/v4.5/edit",
    modelLabel: "Seedream 4.5 Edit",
    prompt: "Create a portrait",
    isModelModalOpen: false,
    modelModalAnchor: null,
    onAspectChange: vi.fn(),
    onModelPickerOpen: vi.fn(),
    onPromptChange: vi.fn(),
    onGenerate: vi.fn(),
    onChatOffInlineGenerate: vi.fn(),
    onSavePrompt: vi.fn(),
  };

  const renderPanel = (
    overrides: Partial<React.ComponentProps<typeof CreatePropertiesPanel>> = {}
  ) => render(<CreatePropertiesPanel {...baseProps} {...overrides} />);
  const promptOutputMessage = (content = "Here is a revised prompt.") => ({
    id: "assistant-1",
    role: "assistant" as const,
    content,
    outputPrompt: content,
    canUseAsPrompt: true,
  });

  it("caps the expert create composer before it can push the control lane too low", () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const minHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "minHeight"
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", {
      configurable: true,
      get() {
        return "36px";
      },
    });

    try {
      renderPanel({
        beginnerMode: false,
        expertCreateUiEligible: true,
        agentEnabled: true,
        chatModeEnabled: true,
        agentInput: "Long create prompt",
        onAgentInputChange: vi.fn(),
        onAgentSend: vi.fn(),
      });

      const composerInput = screen.getByRole("textbox");
      fireEvent.focus(composerInput);

      expect(composerInput).toHaveStyle({ height: "520px", overflowY: "auto" });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(
          HTMLTextAreaElement.prototype as HTMLTextAreaElement & {
            scrollHeight?: number;
          },
          "scrollHeight"
        );
      }
      if (minHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", minHeightDescriptor);
      }
    }
  });

  it("uses a smaller max height for the pulse composer", () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const minHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "minHeight"
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", {
      configurable: true,
      get() {
        return "36px";
      },
    });

    try {
      renderPanel({
        beginnerMode: false,
        expertCreateUiEligible: true,
        agentEnabled: true,
        expertCreateMode: "pulse",
        activePulsePresetId: "image",
        chatModeEnabled: true,
        agentInput: "Long pulse reply",
        onAgentInputChange: vi.fn(),
        onAgentSend: vi.fn(),
      });

      const composerInput = screen.getByRole("textbox");
      fireEvent.focus(composerInput);

      expect(composerInput).toHaveStyle({ height: "280px", overflowY: "auto" });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(
          HTMLTextAreaElement.prototype as HTMLTextAreaElement & {
            scrollHeight?: number;
          },
          "scrollHeight"
        );
      }
      if (minHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", minHeightDescriptor);
      }
    }
  });

  it("renders the expert create prompt and selector controls inside one offset bottom block", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
    });

    const bottomBlock = container.querySelector(".create-expert-bottom-block");
    expect(bottomBlock).toBeTruthy();
    expect(bottomBlock?.querySelector(".create-expert-prompt-step")).toBeTruthy();
    expect(bottomBlock?.querySelector(".create-expert-controls-row")).toBeTruthy();
  });

  it("collapses the expert create composer on blur-outside and re-expands it on refocus", async () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const minHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "minHeight"
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 220,
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", {
      configurable: true,
      get() {
        return "36px";
      },
    });

    try {
      renderPanel({
        beginnerMode: false,
        expertCreateUiEligible: true,
        agentEnabled: true,
        chatModeEnabled: true,
        agentInput: "Long create prompt",
        onAgentInputChange: vi.fn(),
        onAgentSend: vi.fn(),
      });

      const composerInput = screen.getByRole("textbox");
      const chatModeToggle = screen.getByRole("button", { name: "Disable chat mode" });

      await waitFor(() => {
        expect(composerInput).toHaveStyle({ height: "36px", overflowY: "hidden" });
      });

      fireEvent.focus(composerInput);
      await waitFor(() => {
        expect(composerInput).toHaveStyle({ height: "220px", overflowY: "hidden" });
      });

      fireEvent.blur(composerInput, { relatedTarget: chatModeToggle });
      await waitFor(() => {
        expect(composerInput).toHaveStyle({ height: "36px", overflowY: "hidden" });
      });

      fireEvent.focus(composerInput);
      await waitFor(() => {
        expect(composerInput).toHaveStyle({ height: "220px", overflowY: "hidden" });
      });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(
          HTMLTextAreaElement.prototype as HTMLTextAreaElement & {
            scrollHeight?: number;
          },
          "scrollHeight"
        );
      }
      if (minHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", minHeightDescriptor);
      }
    }
  });

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

  it("opens the character library from the picker header action", () => {
    const onOpenCharacterLibrary = vi.fn();
    renderPanel({
      beginnerMode: true,
      characterModeEnabled: true,
      characterOptions: [{ id: "char-1", name: "Avery Pulse" }],
      selectedCharacterId: "char-1",
      onOpenCharacterLibrary,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open character picker" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Character Library" }));

    expect(onOpenCharacterLibrary).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Choose character" })).not.toBeInTheDocument();
  });

  it("shows look choices in the picker and applies the selected look with the character", async () => {
    const onSelectedCharacterIdChange = vi.fn();
    const loadCharacterLookOptions = vi
      .fn<
        (characterId: string) => Promise<Array<{ id: string; label: string; isDefault: boolean }>>
      >()
      .mockResolvedValue([
        { id: "1", label: "Look 1", isDefault: true },
        { id: "2", label: "Hero Close-Up", isDefault: false },
      ]);
    renderPanel({
      beginnerMode: true,
      characterModeEnabled: true,
      characterOptions: [{ id: "char-1", name: "Avery Pulse" }],
      selectedCharacterId: "char-1",
      selectedCharacterLookId: "1",
      onSelectedCharacterIdChange,
      loadCharacterLookOptions,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open character picker" }));

    const lookTrigger = await screen.findByRole("button", {
      name: "Choose look for Avery Pulse",
    });
    fireEvent.click(lookTrigger);
    fireEvent.click(await screen.findByRole("option", { name: "Hero Close-Up" }));

    expect(onSelectedCharacterIdChange).toHaveBeenCalledWith("char-1", "2");
    expect(screen.queryByRole("dialog", { name: "Choose character" })).not.toBeInTheDocument();
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

  it("hides the expert empty-state shell once a standard-mode thread has started with a user message", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "standard",
      agentMessages: [
        {
          id: "user-1",
          role: "user",
          content: "Make this a polished ad concept.",
        },
      ],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.queryByText("What do you want to make?")).not.toBeInTheDocument();
    expect(container.querySelector(".create-expert-empty-state-shell")).toBeFalsy();
    expect(container.querySelector(".create-expert-empty-preview-frame")).toBeFalsy();
    expect(container.querySelector(".create-expert-lower-preview-frame")).toBeFalsy();
  });

  it("keeps a newly arrived standard-mode assistant reply visible across rerenders", () => {
    const { rerender } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "standard",
      agentMessages: [
        {
          id: "user-1",
          role: "user",
          content: "Make this a polished ad concept.",
        },
      ],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.queryByText("What do you want to make?")).not.toBeInTheDocument();
    expect(screen.getByText("Make this a polished ad concept.")).toBeInTheDocument();

    rerender(
      <CreatePropertiesPanel
        {...baseProps}
        beginnerMode={false}
        expertCreateUiEligible
        agentEnabled
        expertCreateMode="standard"
        agentMessages={[
          {
            id: "user-1",
            role: "user",
            content: "Make this a polished ad concept.",
          },
          {
            id: "assistant-1",
            role: "assistant",
            content: "Polished luxury fragrance ad with cinematic reflections.",
          },
        ]}
        onAgentInputChange={vi.fn()}
        onAgentSend={vi.fn()}
      />
    );

    expect(
      screen.getByText("Polished luxury fragrance ad with cinematic reflections.")
    ).toBeInTheDocument();
    expect(screen.queryByText("What do you want to make?")).not.toBeInTheDocument();
  });

  it("keeps the expert empty-state shell visible even when a pulse workflow session exists before thread messages render", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      pulseWorkflowSession: {
        presetId: "story_builder",
        status: "running",
        currentStepIndex: 1,
        currentStepLabel: "Story Setup",
        currentStepPrompt: "Tell me the story genre and tone.",
        collectedInputs: [],
        lastArtifact: null,
      },
      agentMessages: [],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.getByText("What do you want to make?")).toBeInTheDocument();
    expect(screen.queryByText("Send your next instruction.")).not.toBeInTheDocument();
    expect(container.querySelector(".create-expert-empty-state-shell")).toBeTruthy();
    expect(container.querySelector(".create-expert-empty-preview-frame")).toBeTruthy();
    expect(container.querySelector(".create-expert-lower-preview-frame")).toBeTruthy();
  });

  it("keeps the pulse chat surface unmounted until transcript rows actually render", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      pulseWorkflowSession: {
        presetId: "story_builder",
        status: "running",
        currentStepIndex: 1,
        currentStepLabel: "Story Setup",
        currentStepPrompt: "Tell me the story genre and tone.",
        collectedInputs: [],
        lastArtifact: null,
      },
      agentMessages: [],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(container.querySelector(".agent-chat-wrapper")).toBeNull();
    expect(container.querySelector(".create-expert-chat-spacer")).toBeTruthy();
  });

  it("replaces the expert empty-state shell with a startup loading card while a pulse activation is in progress", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      agentIsSending: true,
      agentTransportSending: true,
      pulseWorkflowSession: {
        presetId: "story_builder",
        status: "running",
        currentStepIndex: 1,
        currentStepLabel: "Upload Characters",
        currentStepPrompt: "Upload your characters.",
        collectedInputs: [],
        lastArtifact: null,
      },
      agentMessages: [],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.getByText("Generating...")).toBeInTheDocument();
    expect(screen.queryByText("Preparing your guided workflow...")).not.toBeInTheDocument();
    expect(screen.queryByText("Upload Characters")).not.toBeInTheDocument();
    expect(screen.queryByText("What do you want to make?")).not.toBeInTheDocument();
    expect(container.querySelector(".create-expert-empty-state-shell")).toBeNull();
    expect(container.querySelector(".create-expert-pulse-loading-card")).toBeTruthy();
    expect(container.querySelector(".create-expert-pulse-loading-spinner")).toBeTruthy();
  });

  it("renders a generation loading card inside an active pulse thread while the next step is responding", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "image",
      agentTransportSending: true,
      pulseWorkflowSession: {
        presetId: "image",
        status: "running",
        currentStepIndex: 2,
        currentStepLabel: "Camera Motion",
        currentStepPrompt: "Describe camera motion.",
        collectedInputs: [],
        lastArtifact: null,
      },
      agentIsSending: true,
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Upload your image to get the process started :)",
        },
        {
          id: "user-1",
          role: "user",
          content: "Uploaded.",
        },
      ],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.getByText("Generating...")).toBeInTheDocument();
    expect(
      screen.queryByText("Building the next instruction for Camera Motion.")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Camera Motion")).not.toBeInTheDocument();
    expect(screen.queryByText("Thinking…")).not.toBeInTheDocument();
    expect(container.querySelector(".create-expert-pulse-loading-card")).toBeTruthy();
    expect(container.querySelector(".create-expert-pulse-loading-spinner")).toBeTruthy();
  });

  it("fades the expert title out at eight visual rows and fades it back in below that threshold", async () => {
    let scrollHeightPx = 180;
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const lineHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "lineHeight"
    );
    const paddingTopDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "paddingTop"
    );
    const paddingBottomDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "paddingBottom"
    );
    const minHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "minHeight"
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => scrollHeightPx,
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "lineHeight", {
      configurable: true,
      get() {
        return "24px";
      },
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "paddingTop", {
      configurable: true,
      get() {
        return "6px";
      },
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "paddingBottom", {
      configurable: true,
      get() {
        return "6px";
      },
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", {
      configurable: true,
      get() {
        return "36px";
      },
    });

    try {
      const { rerender } = renderPanel({
        beginnerMode: false,
        expertCreateUiEligible: true,
        agentEnabled: true,
        chatModeEnabled: false,
        agentMessages: [],
        stagedPrompt: null,
        agentInput: "Seven visual rows",
        onAgentInputChange: vi.fn(),
        onAgentSend: vi.fn(),
      });

      const title = screen.getByText("What do you want to make?");
      await waitFor(() => {
        expect(title).not.toHaveClass("is-hidden");
      });

      scrollHeightPx = 204;
      rerender(
        <CreatePropertiesPanel
          {...baseProps}
          beginnerMode={false}
          expertCreateUiEligible
          agentEnabled
          chatModeEnabled={false}
          agentMessages={[]}
          stagedPrompt={null}
          prompt="Eight visual rows"
          onAgentInputChange={vi.fn()}
          onAgentSend={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("What do you want to make?")).toHaveClass("is-hidden");
      });

      scrollHeightPx = 180;
      rerender(
        <CreatePropertiesPanel
          {...baseProps}
          beginnerMode={false}
          expertCreateUiEligible
          agentEnabled
          chatModeEnabled={false}
          agentMessages={[]}
          stagedPrompt={null}
          prompt="Back below threshold"
          onAgentInputChange={vi.fn()}
          onAgentSend={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("What do you want to make?")).not.toHaveClass("is-hidden");
      });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(
          HTMLTextAreaElement.prototype as HTMLTextAreaElement & {
            scrollHeight?: number;
          },
          "scrollHeight"
        );
      }
      if (lineHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "lineHeight", lineHeightDescriptor);
      }
      if (paddingTopDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "paddingTop", paddingTopDescriptor);
      }
      if (paddingBottomDescriptor) {
        Object.defineProperty(
          CSSStyleDeclaration.prototype,
          "paddingBottom",
          paddingBottomDescriptor
        );
      }
      if (minHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", minHeightDescriptor);
      }
    }
  });

  it("renders the expert create composer in a bottom overlay lane when chat history exists", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(container.querySelector(".create-expert-chat-composer-overlay-zone")).toBeTruthy();
    expect(container.querySelector(".create-expert-chat-composer-base-layer")).toBeTruthy();
    expect(container.querySelector(".create-expert-chat-composer-overlay")).toBeTruthy();
  });

  it("keeps the pulse composer in normal flow so it only moves down as chat content grows", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "image",
      agentTransportSending: true,
      pulseWorkflowSession: {
        presetId: "image",
        status: "running",
        currentStepIndex: 1,
        currentStepLabel: "Image Gate",
        currentStepPrompt: "Upload your image.",
        collectedInputs: [],
        lastArtifact: null,
      },
      agentMessages: [],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(container.querySelector(".create-expert-chat-composer-overlay-zone")).toBeNull();
    expect(container.querySelector(".create-expert-chat-composer-overlay")).toBeNull();
    expect(container.querySelector(".create-expert-pulse-loading-card")).toBeTruthy();
  });

  it("gives pulse chat history a taller scroll threshold before it starts scrolling", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "image",
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is a revised prompt.",
        },
      ],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(container.querySelector(".agent-messages")).toHaveStyle({
      maxHeight: "min(62vh, 680px)",
    });
  });

  it("keeps the chat-history underlay unblurred until the composer reaches eight visual rows", async () => {
    let scrollHeightPx = 180;
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight"
    );
    const lineHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "lineHeight"
    );
    const paddingTopDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "paddingTop"
    );
    const paddingBottomDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "paddingBottom"
    );
    const minHeightDescriptor = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "minHeight"
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => scrollHeightPx,
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "lineHeight", {
      configurable: true,
      get() {
        return "24px";
      },
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "paddingTop", {
      configurable: true,
      get() {
        return "6px";
      },
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "paddingBottom", {
      configurable: true,
      get() {
        return "6px";
      },
    });
    Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", {
      configurable: true,
      get() {
        return "36px";
      },
    });

    try {
      const { container, rerender } = renderPanel({
        beginnerMode: false,
        expertCreateUiEligible: true,
        agentEnabled: true,
        chatModeEnabled: true,
        agentMessages: [
          {
            id: "assistant-1",
            role: "assistant",
            content: "Here is a revised prompt.",
          },
        ],
        agentInput: "Seven visual rows",
        onAgentInputChange: vi.fn(),
        onAgentSend: vi.fn(),
      });

      const composerInput = screen.getByRole("textbox");
      fireEvent.focus(composerInput);

      await waitFor(() => {
        expect(
          container.querySelector(".create-expert-chat-composer-overlay-zone")
        ).not.toHaveClass("is-composer-expanded");
      });

      scrollHeightPx = 204;
      rerender(
        <CreatePropertiesPanel
          {...baseProps}
          beginnerMode={false}
          expertCreateUiEligible
          agentEnabled
          chatModeEnabled
          agentMessages={[
            {
              id: "assistant-1",
              role: "assistant",
              content: "Here is a revised prompt.",
            },
          ]}
          agentInput="Eight visual rows"
          onAgentInputChange={vi.fn()}
          onAgentSend={vi.fn()}
        />
      );

      const nextComposerInput = screen.getByRole("textbox");
      fireEvent.focus(nextComposerInput);

      await waitFor(() => {
        expect(container.querySelector(".create-expert-chat-composer-overlay-zone")).toHaveClass(
          "is-composer-expanded"
        );
      });
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor
        );
      } else {
        Reflect.deleteProperty(
          HTMLTextAreaElement.prototype as HTMLTextAreaElement & {
            scrollHeight?: number;
          },
          "scrollHeight"
        );
      }
      if (lineHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "lineHeight", lineHeightDescriptor);
      }
      if (paddingTopDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "paddingTop", paddingTopDescriptor);
      }
      if (paddingBottomDescriptor) {
        Object.defineProperty(
          CSSStyleDeclaration.prototype,
          "paddingBottom",
          paddingBottomDescriptor
        );
      }
      if (minHeightDescriptor) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "minHeight", minHeightDescriptor);
      }
    }
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
    expect(container.querySelectorAll(".create-expert-empty-preview-frame")).toHaveLength(1);
    expect(container.querySelector(".create-expert-lower-preview-frame")).toBeTruthy();
    expect(container.querySelector(".create-expert-empty-top-spacer")).toBeFalsy();
    expect(container.querySelector(".create-expert-chat-spacer")).toBeTruthy();
    expect(screen.queryByText("References attach from the message bar.")).not.toBeInTheDocument();
    expect(screen.queryByText("Send your next instruction.")).not.toBeInTheDocument();
  });

  it("hides the left pulse rail in standard mode", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      agentMessages: [],
    });

    const panelShell = container.querySelector(".create-expert-panel-shell");
    const leftPanel = container.querySelector(".create-expert-left-panel");
    const rightPanel = container.querySelector(".create-expert-right-panel");
    const rightPanelInner = container.querySelector(".create-expert-right-panel-inner");
    const emptyStateShell = container.querySelector(".create-expert-empty-state-shell");

    expect(panelShell).toBeTruthy();
    expect(leftPanel).toBeFalsy();
    expect(rightPanel).toBeTruthy();
    expect(rightPanelInner).toBeTruthy();
    expect(rightPanel?.contains(rightPanelInner)).toBe(true);
    expect(rightPanelInner?.contains(emptyStateShell)).toBe(true);
    expect(screen.queryByText("Prompt Presets")).not.toBeInTheDocument();
  });

  it("shows the left pulse rail only after toggling to pulse", async () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      onClearAgentChat: vi.fn(),
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Draft prompt",
        },
      ],
    });

    const rightPanelTopbar = container.querySelector(".create-expert-right-panel-topbar");
    const tablist = screen.getByRole("tablist", { name: "Create mode" });
    expect(tablist).toBeInTheDocument();
    expect(rightPanelTopbar?.contains(tablist)).toBe(true);
    expect(rightPanelTopbar?.contains(screen.getByRole("button", { name: "Clear chat" }))).toBe(
      true
    );
    expect(container.querySelector(".create-expert-left-panel")).toBeFalsy();
    const standardTab = screen.getByRole("tab", { name: "Standard" });
    const pulseTab = screen.getByRole("tab", { name: "Pulse" });
    expect(standardTab).toHaveAttribute("aria-selected", "true");
    expect(pulseTab).toHaveAttribute("aria-selected", "false");

    fireEvent.click(pulseTab);

    const updatedStandardTab = screen.getByRole("tab", { name: "Standard" });
    const updatedPulseTab = screen.getByRole("tab", { name: "Pulse" });
    expect(updatedStandardTab).toHaveAttribute("aria-selected", "false");
    expect(updatedPulseTab).toHaveAttribute("aria-selected", "true");
    await waitFor(() => {
      expect(container.querySelector(".create-expert-left-panel")).toBeTruthy();
      expect(screen.getByText("Pulses")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Video Prompt Magic preset" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Multi Sequence Video Prompt preset" })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "DFY Story Builder preset" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Single-shot preset" })).not.toBeInTheDocument();
    });
  });

  it("starts a clicked pulse chip and renders the guided session state", async () => {
    const onPulsePresetStart = vi.fn(async (_preset?: unknown, _options?: unknown) => {
      void _preset;
      void _options;
      return { status: "started" as const };
    });

    function PulseHarness() {
      const [expertCreateMode, setExpertCreateMode] = React.useState<"standard" | "pulse">(
        "standard"
      );
      const [activePulsePresetId, setActivePulsePresetId] = React.useState<string | null>(null);
      const [pulseWorkflowSession, setPulseWorkflowSession] =
        React.useState<React.ComponentProps<typeof CreatePropertiesPanel>["pulseWorkflowSession"]>(
          null
        );
      const [agentMessages, setAgentMessages] = React.useState<
        NonNullable<React.ComponentProps<typeof CreatePropertiesPanel>["agentMessages"]>
      >([]);

      return (
        <CreatePropertiesPanel
          {...baseProps}
          beginnerMode={false}
          expertCreateUiEligible
          agentEnabled
          agentMessages={agentMessages}
          expertCreateMode={expertCreateMode}
          onExpertCreateModeChange={setExpertCreateMode}
          activePulsePresetId={activePulsePresetId}
          hasActivePulseSession={Boolean(activePulsePresetId)}
          pulseWorkflowSession={pulseWorkflowSession}
          onAgentInputChange={vi.fn()}
          onAgentSend={vi.fn()}
          onActivePulsePresetIdChange={(presetId) => {
            setActivePulsePresetId(presetId);
            if (!presetId) {
              setPulseWorkflowSession(null);
              setAgentMessages([]);
              return null;
            }
            return "pulse-session-harness";
          }}
          onPulsePresetStart={async (preset, options) => {
            const result = await onPulsePresetStart(preset, options);
            if (result?.status === "started") {
              setPulseWorkflowSession({
                presetId: preset.presetId,
                status: "awaiting_input",
                currentStepIndex: 1,
                currentStepLabel: "Upload Characters",
                currentStepPrompt:
                  "Step 1 - Upload your characters. Please upload 1-3+ character images.",
                collectedInputs: [],
                lastArtifact: null,
                finalArtifactSource: null,
              });
              setAgentMessages([
                {
                  id: "pulse-assistant-1",
                  role: "assistant",
                  content: "Step 1 - Upload your characters. Please upload 1-3+ character images.",
                },
              ]);
            }
            return result;
          }}
        />
      );
    }

    render(<PulseHarness />);

    fireEvent.click(screen.getByRole("tab", { name: "Pulse" }));
    fireEvent.click(screen.getByRole("button", { name: "DFY Story Builder preset" }));

    await waitFor(() => {
      expect(onPulsePresetStart).toHaveBeenCalledWith(
        expect.objectContaining({
          presetId: "story_builder",
          label: "DFY Story Builder",
        }),
        { pulseSessionInstanceId: "pulse-session-harness" }
      );
      expect(screen.getByRole("button", { name: "DFY Story Builder preset" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(
        screen.getByText(/Upload your characters\. Please upload 1-3\+ character images\./)
      ).toBeInTheDocument();
    });
  });

  it("keeps a durable pulse activation error visible in the rail when kickoff fails", async () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      onActivePulsePresetIdChange: () => "pulse-session-failed",
      onPulsePresetStart: async () => ({
        status: "failed",
        reason: "transport_error",
        message: "Agent request failed (500)",
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: "DFY Story Builder preset" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Agent request failed (500)");
    });

    expect(screen.getByRole("button", { name: "Dismiss pulse status" })).toBeInTheDocument();
  });

  it("notifies page-level expert create mode changes when the toggle is used", () => {
    const onExpertCreateModeChange = vi.fn();

    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      onExpertCreateModeChange,
    });

    fireEvent.click(screen.getByRole("tab", { name: "Pulse" }));
    fireEvent.click(screen.getByRole("tab", { name: "Standard" }));

    expect(onExpertCreateModeChange).toHaveBeenNthCalledWith(1, "pulse");
    expect(onExpertCreateModeChange).toHaveBeenNthCalledWith(2, "standard");
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
    expect(openStylesButton.closest(".edit-expert-styles-control")).toHaveClass("is-open");
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
    const label = stylesButton.querySelector(
      ".edit-expert-styles-btn-label"
    ) as HTMLSpanElement | null;
    expect(preview).toBeTruthy();
    expect(label).toBeTruthy();
    expect(stylesButton).toHaveAttribute("aria-label", "Styles");
    expect(preview?.style.backgroundImage).toContain("/Styles/Cinematic.png");
  });

  it("forces chat mode on and hides chat-mode/styles controls in pulse mode", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      chatModeEnabled: false,
      expertCreateMode: "pulse",
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      onStylesPanelToggle: vi.fn(),
    });

    expect(screen.queryByText("Chat Mode")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enable chat mode" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Styles" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate with current prompt" })).toBeNull();
    expect(screen.getByRole("button", { name: "Send to agent" })).toBeInTheDocument();
  });

  it("hides the lower create controls cluster in pulse mode", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      imageResolution: "2k",
      onImageResolutionChange: vi.fn(),
    });

    expect(container.querySelector(".create-expert-controls-row")).toBeNull();
    expect(screen.queryByRole("button", { name: "Disable character mode" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open model picker" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Aspect ratio" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Image resolution" })).toBeNull();
  });

  it("surfaces an explicit deactivate control for active pulses", () => {
    const onClearAgentChat = vi.fn();

    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      onClearAgentChat,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.queryByRole("button", { name: "Clear chat" })).not.toBeInTheDocument();

    const deactivateButton = screen.getByRole("button", { name: "Deactivate pulse" });
    expect(deactivateButton).toBeInTheDocument();

    fireEvent.click(deactivateButton);
    expect(onClearAgentChat).toHaveBeenCalledTimes(1);
  });

  it("keeps the expert empty shell visible before a pulse conversation has started", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "image",
      pulseWorkflowSession: {
        presetId: "image",
        status: "idle",
        currentStepIndex: 1,
        currentStepLabel: "Image Gate",
        currentStepPrompt: "Upload your image to get the process started :)",
        collectedInputs: [],
        lastArtifact: null,
      },
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.getByText("What do you want to make?")).toBeInTheDocument();
    expect(screen.queryByText("Send your next instruction.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Active pulse session")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".create-expert-empty-preview-frame")).toHaveLength(1);
    expect(container.querySelector(".create-expert-lower-preview-frame")).toBeTruthy();
  });

  it("hides chat-history inline generate controls in pulse mode", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      agentMessages: [{ id: "a-1", role: "assistant", content: "Assistant output one." }],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.queryByRole("button", { name: "Generate from this agent output" })).toBeNull();
    expect(screen.getByText("Assistant output one.")).toBeInTheDocument();
  });

  it("renders pulse-mode assistant replies with guided list formatting", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      agentMessages: [
        {
          id: "a-1",
          role: "assistant",
          content:
            "CURRENT STEP\n\nWhich camera motion should I use? Pick one from the list below.\n\n1) Static - Locked-off camera\n2) Pan - Rotates horizontally\n3) Dolly In - Moves camera closer\n\nReply with one option or type your own.",
        },
      ],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.queryByText("CURRENT STEP")).not.toBeInTheDocument();
    expect(screen.getByText("Reply with one option or type your own.")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Static - Locked-off camera");
    expect(items[1]).toHaveTextContent("Pan - Rotates horizontally");
    expect(items[2]).toHaveTextContent("Dolly In - Moves camera closer");
  });

  it("does not replace the expert empty shell with pulse chrome before any pulse history exists", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "image",
      pulseWorkflowSession: {
        presetId: "image",
        status: "awaiting_input",
        currentStepIndex: 2,
        currentStepLabel: "Camera Motion",
        currentStepPrompt:
          "Step 2 - Which camera motion should I use? Pick one from the list below OR type any camera motion you want.",
        collectedInputs: [],
        lastArtifact: null,
      },
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.getByText("What do you want to make?")).toBeInTheDocument();
    expect(screen.queryByText("Send your next instruction.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Active pulse session")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".create-expert-empty-preview-frame")).toHaveLength(1);
  });

  it("renders workflow guidance without extra pulse session chrome", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "pulse_guided_video",
      pulseWorkflowSession: {
        presetId: "pulse_guided_video",
        status: "awaiting_input",
        currentStepIndex: 2,
        currentStepLabel: "Camera Motion",
        currentStepPrompt:
          "Which camera motion should I use? Pick one from the list below or type your own.",
        collectedInputs: ["uploaded image"],
        lastArtifact: null,
      },
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content:
            "CURRENT STEP\n\nWhich camera motion should I use? Pick one from the list below or type your own.",
        },
      ],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(
      screen.getByText(
        "Which camera motion should I use? Pick one from the list below or type your own."
      )
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Active pulse session")).not.toBeInTheDocument();
    expect(screen.queryByText("Pulse active")).not.toBeInTheDocument();
  });

  it("removes title-case current-step headings from rendered pulse outputs", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "image",
      pulseWorkflowSession: {
        presetId: "image",
        status: "awaiting_input",
        currentStepIndex: 2,
        currentStepLabel: "Camera Motion",
        currentStepPrompt:
          "Which camera motion should I use? Pick one from the list below or type your own.",
        collectedInputs: ["uploaded image"],
        lastArtifact: null,
      },
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content:
            "CURRENT STEP\nCamera Motion\nWhich camera motion should I use? Pick one from the list below or type your own.",
        },
      ],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.queryByText("CURRENT STEP")).not.toBeInTheDocument();
    expect(screen.queryByText("Camera Motion")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Which camera motion should I use? Pick one from the list below or type your own."
      )
    ).toBeInTheDocument();
  });

  it("removes fused current-step labels from rendered pulse outputs", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "multi_shot",
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content:
            "CURRENT STEP\nConcept What is the single-shot concept you want to illustrate? Provide a topic or theme.\n\n1. Emotion moment\n2. Action reveal",
        },
      ],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.queryByText("CURRENT STEP")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Concept What is the single-shot concept you want to illustrate? Provide a topic or theme."
      )
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "What is the single-shot concept you want to illustrate? Provide a topic or theme."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders completed pulse output without the retired pulse session banner", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      pulseWorkflowSession: {
        presetId: "story_builder",
        status: "completed",
        currentStepIndex: 6,
        currentStepLabel: "Image Prompts",
        currentStepPrompt: null,
        collectedInputs: ["grimdark tone", "10 min runtime"],
        lastArtifact:
          "Scene 1: cinematic wide shot of the knight entering the ruined hall under torchlight.",
      },
      agentMessages: [
        {
          id: "assistant-final",
          role: "assistant",
          content:
            "FINAL PROMPT\n\nScene 1: cinematic wide shot of the knight entering the ruined hall under torchlight.",
        },
      ],
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
    });

    expect(screen.queryByLabelText("Completed pulse session")).not.toBeInTheDocument();
    expect(screen.queryByText("Pulse complete")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Generate will use the completed Pulse output.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Scene 1: cinematic wide shot of the knight entering the ruined hall under torchlight."
      )
    ).toBeInTheDocument();
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
    const label = stylesButton.querySelector(
      ".edit-expert-styles-btn-label"
    ) as HTMLSpanElement | null;
    expect(preview).toBeTruthy();
    expect(label).toBeTruthy();
    expect(stylesButton).toHaveAttribute("aria-label", "Styles");
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
    const { container } = renderPanel({
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
    const composerRow = container.querySelector(".agent-composer-row.is-stacked");
    const primaryRow = container.querySelector(".agent-composer-primary-row");
    const inputShell = container.querySelector(".agent-composer-input-shell");
    const selectorRow = container.querySelector(".create-expert-controls");
    expect(composerRow).toBeTruthy();
    expect(primaryRow).toBeTruthy();
    expect(selectorRow).toBeTruthy();
    expect(inputShell).toHaveClass("has-full-width-text");
    expect(inputShell).not.toHaveClass("has-inside-send-button");
    const composerChildren = Array.from(composerRow?.children ?? []);
    expect(composerChildren[0]).toBe(primaryRow);
    expect(composerChildren).toHaveLength(1);
    const primaryChildren = Array.from(primaryRow?.children ?? []);
    expect(primaryChildren[0]?.textContent).toContain("Chat Mode");
    expect(primaryChildren[1]).toBe(inputShell);
    expect(primaryChildren[2]).toContainElement(screen.getByRole("button", { name: "Styles" }));
    expect(
      primaryChildren[3]?.querySelector('[aria-label="Generate with current prompt"]')
    ).toBeTruthy();
    const selectorChildren = Array.from(selectorRow?.children ?? []);
    expect(selectorChildren[0]?.textContent).toContain("Character");
    expect(selectorChildren[0]).toContainElement(
      screen.getByRole("button", { name: "Enable character mode" })
    );
    fireEvent.click(button);
    expect(onChatOffInlineGenerate).toHaveBeenCalledTimes(1);
  });

  it("keeps the stacked expert composer layout when chat mode is enabled", () => {
    const { container } = renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      chatModeEnabled: true,
      agentInput: "Send this as a chat instruction.",
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      characterModeEnabled: true,
    });

    const composerRow = container.querySelector(".agent-composer-row.is-stacked");
    const primaryRow = container.querySelector(".agent-composer-primary-row");
    const inputShell = container.querySelector(".agent-composer-input-shell");
    const selectorRow = container.querySelector(".create-expert-controls");

    expect(composerRow).toBeTruthy();
    expect(primaryRow).toBeTruthy();
    expect(selectorRow).toBeTruthy();
    expect(inputShell).toHaveClass("has-inside-send-button");
    expect(inputShell).not.toHaveClass("has-full-width-text");

    const composerChildren = Array.from(composerRow?.children ?? []);
    expect(composerChildren[0]).toBe(primaryRow);
    expect(composerChildren).toHaveLength(1);

    const primaryChildren = Array.from(primaryRow?.children ?? []);
    expect(primaryChildren[0]).toContainElement(
      screen.getByRole("button", { name: "Disable chat mode" })
    );
    expect(primaryChildren[1]).toBe(inputShell);
    expect(primaryChildren[2]).toContainElement(screen.getByRole("button", { name: "Styles" }));

    const selectorChildren = Array.from(selectorRow?.children ?? []);
    expect(selectorChildren[0]?.textContent).toContain("Character");
    expect(selectorChildren[0]).toContainElement(
      screen.getByRole("button", { name: "Disable character mode" })
    );
    expect(inputShell).toContainElement(screen.getByRole("button", { name: "Send to agent" }));
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

  it("keeps chat-off inline generate enabled when shared output guards are clear", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      chatModeEnabled: false,
      agentInput: "Allow immediate re-clicks for the inline generate button.",
      onGenerate: vi.fn(),
      onChatOffInlineGenerate: vi.fn(),
      characterModeEnabled: false,
      isGenerateDisabled: false,
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
    expect(onSelectedCharacterIdChange).toHaveBeenCalledWith("char-2", "");
  });

  it("shows the selected look label in the expert character chip", () => {
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
      onAgentInputChange: vi.fn(),
      onAgentSend: vi.fn(),
      characterModeEnabled: true,
      characterOptions: [{ id: "char-1", name: "Avery Pulse" }],
      selectedCharacterId: "char-1",
      selectedCharacterLookLabel: "Hero Close-Up",
    });

    expect(screen.getByText("Avery Pulse · Hero Close-Up")).toBeInTheDocument();
  });

  it("keeps the expert model selector visible in character mode and preserves selected model when toggled off", () => {
    const onCharacterModeEnabledChange = vi.fn();
    const onModelPickerOpen = vi.fn();
    renderPanel({
      beginnerMode: false,
      expertCreateUiEligible: true,
      agentEnabled: true,
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
      agentMessages: [promptOutputMessage()],
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
      agentMessages: [promptOutputMessage()],
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
      agentMessages: [promptOutputMessage()],
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
      agentMessages: [promptOutputMessage()],
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
      agentMessages: [promptOutputMessage()],
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
      agentMessages: [promptOutputMessage()],
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
      agentMessages: [promptOutputMessage()],
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
      agentMessages: [promptOutputMessage()],
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
      agentMessages: [promptOutputMessage()],
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
      agentMessages: [promptOutputMessage()],
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
