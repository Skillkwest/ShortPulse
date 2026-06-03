/**
 * VideoPropertiesPanel inline warning tests.
 * Verifies the Kling standard-mode reference-image warning near the generate row.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VideoPropertiesPanel } from "../VideoPropertiesPanel";
import {
  listCharacterManagerCharacters,
  loadCharacterManagerDraftByCharacterId,
} from "../../../character-manager/logic/characterManagerPersistence";
import {
  fetchElementsManagerList,
  loadElementManagerDraftByElementId,
} from "../../../elements-manager/logic/elementsManagerPersistence";
import { buildElementProfileImageBackgroundStyle } from "../../../elements-manager/logic/elementProfileImageTransform";
import type { AiStudioKlingElement } from "../../logic/klingElements";
import { KLING_ELEMENT_PROMPT_TOKEN_TRANSFER_MIME } from "../../logic/klingPromptReferences";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";

type ReferencePromptStepMockProps = {
  referenceText?: string | null;
  onPromptTextChange?: (value: string) => void;
  onSave?: () => void;
  onDrop?: (event: React.DragEvent<HTMLTextAreaElement>) => void;
  promptTextareaRef?: React.Ref<HTMLTextAreaElement>;
  promptPlaceholder?: string;
  promptHelperText?: string;
  agentIsSending?: boolean;
  agentError?: string;
  onAgentEnhanceSend?: unknown;
};

const referencePromptStepMock = vi.fn((props: ReferencePromptStepMockProps) => {
  void props;
  return <div data-testid="reference-prompt-step" />;
});

const defaultDerivedState = {
  activeVideoMode: "standard",
  isKling3Mode: true,
  isKlingPatternMode: true,
  isKeyframesMode: false,
  isMotionMode: false,
  isStandardMode: true,
  isSeedanceModel: false,
  isSeedance2FamilyModel: false,
  isVeoModel: false,
  referenceStepTitle: "Add References",
  referenceStepSubtitle: "Add references",
  promptOrder: 1,
  promptBadge: "1",
  referenceOrder: 2,
  referenceBadge: "2",
  videoSettingsOrder: 3,
  motionAudioOrder: 3,
  klingAdvancedOrder: 4,
  klingAdvancedBadge: "4",
  klingAssetsOrder: 5,
  klingAssetsBadge: "5",
  aspectOptionsForModel: [
    {
      value: "16:9",
      ratioLabel: "16:9",
      name: "Landscape",
      orientation: "horizontal",
    },
  ],
  durationOptions: [5, 8],
  resolutionOptions: [{ value: "720p", label: "720p" }],
  videoDurationValue: 5,
  videoResolutionValue: "720p",
  videoGenerateAudioValue: false,
};

const useReferencePropertiesDerivedStateMock = vi.fn(() => defaultDerivedState);

vi.mock("../../../character-manager/logic/characterManagerPersistence", () => ({
  listCharacterManagerCharacters: vi.fn(async () => [
    {
      characterId: "character-taylor",
      characterName: "Taylor",
      characterStatus: "active",
      characterSheetId: "sheet-taylor",
      profileImageUrl: "https://example.com/taylor-profile.jpg",
      profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
      characterSheetStatus: "ready",
      updatedAt: "2026-04-07T00:00:00.000Z",
    },
  ]),
  loadCharacterManagerDraftByCharacterId: vi.fn(async () => ({
    userId: "user-1",
    characterId: "character-taylor",
    characterSheetId: "sheet-taylor",
    characterName: "Taylor",
    legacyCharacterDescription: "A poised woman in the scene.",
    characterDescription: "A poised woman in the scene.",
    characterSheetAssignments: {
      portrait: "portrait_close",
      close_up: "front_left_34",
      front_shot: "front_full",
    },
    activeCharacterSheetPresetId: "1",
    characterSheetPresets: {} as never,
    visibleCharacterSheetPresetIds: ["1"],
    characterSheetPresetLabels: { "1": "Preset 1" } as never,
    characterSheetPresetDescriptions: { "1": "" } as never,
    characterSheetPresetAssignments: {
      portrait: {
        mediaFileId: "portrait-1",
        storagePath: "user/characters/portrait-1.png",
        previewUrl: "https://example.com/taylor-01.jpg",
      },
      close_up: {
        mediaFileId: "close-up-1",
        storagePath: "user/characters/close-up-1.png",
        previewUrl: "https://example.com/taylor-02.jpg",
      },
      front_shot: {
        mediaFileId: "front-shot-1",
        storagePath: "user/characters/front-shot-1.png",
        previewUrl: "https://example.com/taylor-03.jpg",
      },
    },
    profileImageUrl: "https://example.com/taylor-profile.jpg",
    profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
    slots: {
      front_full: null,
      side_profile: null,
      back_full: null,
      top_down: null,
      front_left_34: null,
      front_right_34: null,
      back_left_34: null,
      back_right_34: null,
      portrait_close: null,
      fullbody_wide: null,
    },
  })),
}));

vi.mock("../../../elements-manager/logic/elementsManagerPersistence", () => ({
  fetchElementsManagerList: vi.fn(async () => [
    {
      elementId: "element-red-lantern",
      elementName: "Red Lantern",
      elementAlias: "redlantern",
      elementAssetType: "image",
      elementStatus: "ready",
      profileImageUrl: "https://example.com/red-lantern-profile.jpg",
      profileImageTransform: { zoom: 1.35, offsetX: 8, offsetY: -6 },
      updatedAt: "2026-04-07T00:00:00.000Z",
    },
  ]),
  loadElementManagerDraftByElementId: vi.fn(async () => ({
    elementId: "element-red-lantern",
    name: "Red Lantern",
    alias: "redlantern",
    status: "ready",
    profileImageUrl: "https://example.com/red-lantern-profile.jpg",
    profileImageTransform: { zoom: 1.35, offsetX: 8, offsetY: -6 },
    description: "Warm lacquered lantern",
    assetType: "image",
    imageReferenceUrls: [
      "https://example.com/red-lantern-01.jpg",
      "https://example.com/red-lantern-02.jpg",
      "https://example.com/red-lantern-03.jpg",
    ],
    videoReferenceUrl: null,
    updatedAt: "2026-04-07T00:00:00.000Z",
  })),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...imageProps} alt={props.alt ?? ""} />;
  },
}));

vi.mock("../../../../prefabs/agent", () => ({
  AgentGenerateButton: ({
    onClick,
    disabled,
    cost,
  }: {
    onClick: () => void;
    disabled?: boolean;
    cost?: number | string | null;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      Generate {String(cost ?? "")}
    </button>
  ),
}));

vi.mock("../ReferenceMediaStep", () => ({
  ReferenceMediaStep: () => <div data-testid="reference-media-step" />,
}));

vi.mock("../ReferencePromptStep", () => ({
  ReferencePromptStep: (props: ReferencePromptStepMockProps) => {
    referencePromptStepMock(props);
    return (
      <textarea
        aria-label="Video prompt"
        ref={props.promptTextareaRef}
        value={props.referenceText ?? ""}
        onChange={(event) => props.onPromptTextChange?.(event.target.value)}
        onDrop={(event) => props.onDrop?.(event)}
        onDragOver={(event) => event.preventDefault()}
      />
    );
  },
}));

vi.mock("../ReferenceVideoSettingsStep", () => ({
  ReferenceVideoSettingsStep: () => <div data-testid="reference-video-settings-step" />,
}));

vi.mock("../ReferenceKlingAdvancedSteps", () => ({
  ReferenceKlingAdvancedSteps: ({ workflowLabel }: { workflowLabel?: string }) => (
    <div data-testid="reference-kling-advanced-steps">{workflowLabel ?? "Kling 3.0"}</div>
  ),
}));

vi.mock("../useReferencePropertiesConstraintEffects", () => ({
  useReferencePropertiesConstraintEffects: () => undefined,
}));

vi.mock("../useReferencePropertiesInteractions", () => ({
  useReferencePropertiesInteractions: () => ({
    primaryInputRef: { current: null },
    extraOneInputRef: { current: null },
    extraTwoInputRef: { current: null },
    extraThreeInputRef: { current: null },
    motionVideoInputRef: { current: null },
    primaryDragActive: false,
    extraDragActive: [false, false, false],
    motionVideoDragActive: false,
    setMotionVideoDragActive: vi.fn(),
    collapsedSteps: { reference: false, prompt: false, klingAdvanced: false, klingAssets: false },
    toggleStep: vi.fn(),
    expandIfCollapsed: vi.fn(),
    updateKlingMultiPrompt: vi.fn(),
    addKlingShot: vi.fn(),
    removeKlingShot: vi.fn(),
    updateKlingElement: vi.fn(),
    addKlingElement: vi.fn(),
    removeKlingElement: vi.fn(),
    handleFileSelection: vi.fn(),
    handlePromptDrop: vi.fn(),
    handlePrimaryDrop: vi.fn(),
    handleExtraDrop: vi.fn(),
    handlePrimaryDragEnter: vi.fn(),
    handlePrimaryDragOver: vi.fn(),
    handlePrimaryDragLeave: vi.fn(),
    handleExtraDragEnter: vi.fn(),
    handleExtraDragOver: vi.fn(),
    handleExtraDragLeave: vi.fn(),
    allowVideoDrag: vi.fn(() => false),
    handleMotionVideoDrop: vi.fn(),
    handleMotionVideoSelection: vi.fn(),
  }),
}));

vi.mock("../useReferencePropertiesDerivedState", () => ({
  useReferencePropertiesDerivedState: () => useReferencePropertiesDerivedStateMock(),
}));

const baseProps: React.ComponentProps<typeof VideoPropertiesPanel> = {
  aspect: "16:9",
  modelId: KIE_KLING_30_MODEL_ID,
  modelLabel: "Kling 3.0",
  referenceImageUrl: null,
  extraImageUrls: [null, null, null],
  referenceText: "Generate this shot",
  aspectOptions: [
    {
      value: "16:9",
      ratioLabel: "16:9",
      name: "Landscape",
      orientation: "horizontal",
    },
  ],
  isModelModalOpen: false,
  modelModalAnchor: null,
  onAspectChange: vi.fn(),
  onModelPickerOpen: vi.fn(),
  onPrimaryImageChange: vi.fn(),
  onExtraImageChange: vi.fn(),
  onPromptTextChange: vi.fn(),
  onRegenerate: vi.fn(),
  onCreateCharacter: vi.fn(),
  onCreateElement: vi.fn(),
};

const createTransferStore = () => {
  const store: Record<string, string> = {};
  return {
    effectAllowed: "copy",
    dropEffect: "copy",
    types: [],
    setData: vi.fn((type: string, value: string) => {
      store[type] = value;
    }),
    getData: vi.fn((type: string) => store[type] ?? ""),
  } as unknown as DataTransfer;
};

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

function KlingModeStateHarness() {
  const [klingWorkflowMode, setKlingWorkflowMode] = React.useState<"single" | "multi" | "custom">(
    "custom"
  );
  const [klingMultiPrompts, setKlingMultiPrompts] = React.useState([
    { id: "shot-1", prompt: "Shot one prompt", duration: 5 },
    { id: "shot-2", prompt: "Shot two prompt", duration: 5 },
  ]);

  return (
    <>
      <VideoPropertiesPanel
        {...baseProps}
        klingWorkflowMode={klingWorkflowMode}
        klingMultiPrompts={klingMultiPrompts}
        onKlingWorkflowModeChange={setKlingWorkflowMode}
        onKlingMultiPromptsChange={setKlingMultiPrompts}
      />
      <div data-testid="kling-mode-state">{klingWorkflowMode}</div>
      <div data-testid="kling-shot-cache">
        {klingMultiPrompts.map((shot) => `${shot.id}:${shot.prompt}`).join("|")}
      </div>
    </>
  );
}

function KlingPromptDropHarness() {
  const [referenceText, setReferenceText] = React.useState("Taylor walks forward");
  const [klingElements, setKlingElements] = React.useState<AiStudioKlingElement[]>([
    {
      id: "element-01",
      slotIndex: 0,
      sourceElementId: "element-red-lantern",
      name: "Taylor",
      alias: "taylor",
      description: "Lead performer",
      profileImageUrl: "https://example.com/taylor-profile.jpg",
      frontalImageUrl: "https://example.com/taylor-01.jpg",
      referenceImageUrls: "https://example.com/taylor-02.jpg",
      videoUrl: "",
    },
  ]);

  return (
    <VideoPropertiesPanel
      {...baseProps}
      referenceText={referenceText}
      onPromptTextChange={setReferenceText}
      klingElements={klingElements}
      onKlingElementsChange={setKlingElements}
    />
  );
}

function KlingSparseSlotHarness() {
  const [klingElements, setKlingElements] = React.useState<AiStudioKlingElement[]>([
    {
      id: "character-taylor",
      slotIndex: 0,
      sourceKind: "character" as const,
      sourceCharacterId: "character-taylor",
      sourceElementId: null,
      name: "Taylor",
      alias: "",
      description: "Lead performer",
      profileImageUrl: "https://example.com/taylor-profile.jpg",
      frontalImageUrl: "https://example.com/taylor-01.jpg",
      referenceImageUrls: "https://example.com/taylor-02.jpg",
      videoUrl: "",
    },
    {
      id: "element-taylor",
      slotIndex: 1,
      sourceKind: "element" as const,
      sourceCharacterId: null,
      sourceElementId: "element-red-lantern",
      name: "Taylor",
      alias: "taylor",
      description: "Stage prop",
      profileImageUrl: "https://example.com/red-lantern-profile.jpg",
      frontalImageUrl: "https://example.com/red-lantern-01.jpg",
      referenceImageUrls: "https://example.com/red-lantern-02.jpg",
      videoUrl: "",
    },
  ]);

  return (
    <VideoPropertiesPanel
      {...baseProps}
      klingElements={klingElements}
      onKlingElementsChange={setKlingElements}
    />
  );
}

describe("VideoPropertiesPanel", () => {
  beforeEach(() => {
    referencePromptStepMock.mockClear();
    useReferencePropertiesDerivedStateMock.mockReset();
    useReferencePropertiesDerivedStateMock.mockReturnValue(defaultDerivedState);
    vi.mocked(listCharacterManagerCharacters).mockClear();
    vi.mocked(loadCharacterManagerDraftByCharacterId).mockClear();
    vi.mocked(fetchElementsManagerList).mockClear();
    vi.mocked(loadElementManagerDraftByElementId).mockClear();
  });

  it("shows the Kling reference image warning when both standard frame slots are empty", () => {
    render(<VideoPropertiesPanel {...baseProps} />);

    expect(screen.getByText("Reference image required for generation")).toBeInTheDocument();
  });

  it("hides the Kling reference image warning once either standard frame slot has an image", () => {
    const { rerender } = render(<VideoPropertiesPanel {...baseProps} />);

    rerender(
      <VideoPropertiesPanel
        {...baseProps}
        extraImageUrls={["https://example.com/last-frame.jpg", null, null]}
      />
    );

    expect(screen.queryByText("Reference image required for generation")).toBeNull();
  });

  it("renders the recorder in its own left-column panel for Motion Control", () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "motion",
      isMotionMode: true,
      isStandardMode: false,
      referenceStepTitle: "Add Motion Inputs",
    });

    render(<VideoPropertiesPanel {...baseProps} motionVideoUrl={null} />);

    expect(
      screen.getByText("If you do not already have a motion video, you can record one here.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open motion recorder to add a motion clip" })
    ).toBeInTheDocument();
  });

  it("hides the recorder panel once a motion video is already present", () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "motion",
      isMotionMode: true,
      isStandardMode: false,
      referenceStepTitle: "Add Motion Inputs",
    });

    render(
      <VideoPropertiesPanel
        {...baseProps}
        motionVideoUrl="https://example.com/motion-reference.webm"
      />
    );

    expect(screen.queryByText("Need a clip?")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open motion recorder to add a motion clip" })
    ).toBeNull();
  });

  it("hides the hero title block in custom multi-shot mode even when prompts are empty", () => {
    const { container } = render(
      <VideoPropertiesPanel
        {...baseProps}
        referenceText=""
        klingWorkflowMode="custom"
        klingMultiPrompts={[{ id: "shot-1", prompt: "", duration: 5 }]}
        onKlingMultiPromptsChange={vi.fn()}
      />
    );

    expect(screen.queryByText("How will you direct this scene?")).toBeNull();
    expect(container.querySelector(".video-shot-scroll-viewport")).not.toBeNull();
  });

  it("does not render custom multi-shot prompt boxes when Kling is no longer the active model", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_VEO_31_FAST_I2V_MODEL_ID}
        modelLabel="Veo 3.1 Fast"
        klingWorkflowMode="custom"
        klingMultiPrompts={[
          { id: "shot-1", prompt: "Beat one", duration: 5 },
          { id: "shot-2", prompt: "Beat two", duration: 5 },
        ]}
        onKlingMultiPromptsChange={vi.fn()}
      />
    );

    expect(screen.queryByText("Shot 2")).toBeNull();
    expect(screen.queryByLabelText("Add another shot prompt")).toBeNull();
  });

  it("does not render the stale Seedance regional disclaimer", () => {
    render(<VideoPropertiesPanel {...baseProps} />);

    expect(screen.queryByText("Seedance 2.0 is currently unavailable in the U.S.")).toBeNull();
  });

  it("uses the standard single-shot prompt guidance when Kling Multi mode is selected", () => {
    render(<VideoPropertiesPanel {...baseProps} klingWorkflowMode="multi" />);

    const promptProps = referencePromptStepMock.mock.calls[0]?.[0] as
      | { promptPlaceholder?: string; promptHelperText?: string }
      | undefined;
    expect(promptProps).toEqual(
      expect.objectContaining({
        promptPlaceholder:
          "Describe the shot you want to create: subject, action, camera movement, framing, lighting, and mood.",
        promptHelperText:
          "Direct the shot: describe the subject, motion, camera movement, and mood you want in the clip.",
      })
    );
  });

  it("shows the live Kling single-shot character counter", () => {
    render(<VideoPropertiesPanel {...baseProps} referenceText={"A".repeat(1250)} />);

    expect(screen.getByText("Kling prompt")).toBeInTheDocument();
    expect(screen.getByText("1,250 / 2,500 characters")).toBeInTheDocument();
  });

  it("blocks generate when the Kling single-shot prompt exceeds the provider limit", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        referenceImageUrl="https://example.com/first-frame.jpg"
        referenceText={"A".repeat(2501)}
      />
    );

    expect(screen.getByText("Prompt exceeds Kling's 2,500 character limit.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
  });

  it("shows per-shot Kling counters in custom multi-shot mode", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        referenceImageUrl="https://example.com/first-frame.jpg"
        klingWorkflowMode="custom"
        klingMultiPrompts={[
          { id: "shot-1", prompt: "A".repeat(120), duration: 5 },
          { id: "shot-2", prompt: "B".repeat(220), duration: 5 },
        ]}
        onKlingMultiPromptsChange={vi.fn()}
      />
    );

    expect(screen.getAllByText("Kling shot prompt")).toHaveLength(2);
    expect(screen.getByText("120 / 500 characters")).toBeInTheDocument();
    expect(screen.getByText("220 / 500 characters")).toBeInTheDocument();
  });

  it("blocks generate when any custom Kling shot exceeds the documented per-shot limit", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        referenceImageUrl="https://example.com/first-frame.jpg"
        klingWorkflowMode="custom"
        klingMultiPrompts={[
          { id: "shot-1", prompt: "A".repeat(120), duration: 5 },
          { id: "shot-2", prompt: "B".repeat(501), duration: 5 },
        ]}
        onKlingMultiPromptsChange={vi.fn()}
      />
    );

    expect(
      screen.getByText("Shot prompt exceeds Kling's 500 character limit.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
  });

  it("preserves custom shot text when switching from custom to single or multi", () => {
    render(<KlingModeStateHarness />);

    expect(screen.getByTestId("kling-mode-state")).toHaveTextContent("custom");
    expect(screen.getByTestId("kling-shot-cache")).toHaveTextContent(
      "shot-1:Shot one prompt|shot-2:Shot two prompt"
    );

    fireEvent.click(screen.getByRole("tab", { name: "Single shot" }));
    expect(screen.getByTestId("kling-mode-state")).toHaveTextContent("single");
    expect(screen.getByTestId("kling-shot-cache")).toHaveTextContent(
      "shot-1:Shot one prompt|shot-2:Shot two prompt"
    );

    fireEvent.click(screen.getByRole("tab", { name: "Multi-shot" }));
    expect(screen.getByTestId("kling-mode-state")).toHaveTextContent("multi");
    expect(screen.getByTestId("kling-shot-cache")).toHaveTextContent(
      "shot-1:Shot one prompt|shot-2:Shot two prompt"
    );

    fireEvent.click(screen.getByRole("tab", { name: "Custom multi-shot" }));
    expect(screen.getByTestId("kling-mode-state")).toHaveTextContent("custom");
    expect(screen.getByTestId("kling-shot-cache")).toHaveTextContent(
      "shot-1:Shot one prompt|shot-2:Shot two prompt"
    );
  });

  it("does not show a parked custom shots note when cached custom prompts exist", () => {
    const { rerender } = render(
      <VideoPropertiesPanel
        {...baseProps}
        klingWorkflowMode="single"
        klingMultiPrompts={[
          { id: "shot-1", prompt: "Shot one prompt", duration: 5 },
          { id: "shot-2", prompt: "Shot two prompt", duration: 5 },
        ]}
      />
    );

    expect(
      screen.queryByRole("note", { name: "Saved custom shot prompts are inactive" })
    ).toBeNull();

    rerender(
      <VideoPropertiesPanel
        {...baseProps}
        klingWorkflowMode="multi"
        klingMultiPrompts={[
          { id: "shot-1", prompt: "Shot one prompt", duration: 5 },
          { id: "shot-2", prompt: "Shot two prompt", duration: 5 },
        ]}
      />
    );

    expect(
      screen.queryByRole("note", { name: "Saved custom shot prompts are inactive" })
    ).toBeNull();

    rerender(
      <VideoPropertiesPanel
        {...baseProps}
        klingWorkflowMode="custom"
        klingMultiPrompts={[
          { id: "shot-1", prompt: "Shot one prompt", duration: 5 },
          { id: "shot-2", prompt: "Shot two prompt", duration: 5 },
        ]}
      />
    );

    expect(
      screen.queryByRole("note", { name: "Saved custom shot prompts are inactive" })
    ).toBeNull();
  });

  it("does not render the redundant Seedance 2.x advanced settings card", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_FAST_MODEL_ID}
        modelLabel="Seedance 2.0 Fast"
      />
    );

    expect(screen.queryByTestId("reference-seedance-advanced-steps")).toBeNull();
    expect(screen.queryByTestId("reference-kling-advanced-steps")).toBeNull();
    expect(screen.getByRole("tab", { name: "Single shot" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Multi-shot" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Custom multi-shot" })).toBeNull();
  });

  it("maps stale Seedance 2 custom mode to the single-pipeline Multi tab", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2.0"
        klingWorkflowMode="custom"
      />
    );

    expect(screen.getByRole("tab", { name: "Multi-shot" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.queryByRole("tab", { name: "Custom multi-shot" })).toBeNull();
    expect(screen.queryByText("Shot 2")).toBeNull();
  });

  it("keeps both create buttons visible when both libraries are empty", async () => {
    vi.mocked(listCharacterManagerCharacters).mockResolvedValueOnce([]);
    vi.mocked(fetchElementsManagerList).mockResolvedValueOnce([]);

    render(<VideoPropertiesPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 1" }));

    expect(await screen.findByRole("button", { name: "Create New Character" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Create New Element" })).toBeInTheDocument();
    expect(await screen.findByText("No saved Characters available.")).toBeInTheDocument();
    expect(await screen.findByText("No saved Elements available.")).toBeInTheDocument();
    expect(screen.queryByText("No saved Characters or Elements available.")).toBeNull();
  });

  it("shows section loading states on first open without flashing the old empty message", async () => {
    const deferredCharacters =
      createDeferred<Awaited<ReturnType<typeof listCharacterManagerCharacters>>>();
    const deferredElements = createDeferred<Awaited<ReturnType<typeof fetchElementsManagerList>>>();
    vi.mocked(listCharacterManagerCharacters).mockReturnValueOnce(deferredCharacters.promise);
    vi.mocked(fetchElementsManagerList).mockReturnValueOnce(deferredElements.promise);

    render(<VideoPropertiesPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 1" }));

    await waitFor(() => {
      expect(screen.getByText("Loading saved Characters...")).toBeInTheDocument();
      expect(screen.getByText("Loading saved Elements...")).toBeInTheDocument();
    });
    expect(screen.queryByText("No saved Characters available.")).toBeNull();
    expect(screen.queryByText("No saved Elements available.")).toBeNull();
    expect(screen.queryByText("No saved Characters or Elements available.")).toBeNull();

    deferredCharacters.resolve([]);
    deferredElements.resolve([]);
    await waitFor(() => {
      expect(screen.getByText("No saved Characters available.")).toBeInTheDocument();
      expect(screen.getByText("No saved Elements available.")).toBeInTheDocument();
    });
  });

  it("keeps the elements section usable when characters fail to load", async () => {
    vi.mocked(listCharacterManagerCharacters).mockRejectedValueOnce(new Error("character failure"));

    render(<VideoPropertiesPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 1" }));

    expect(await screen.findByRole("button", { name: "Create New Character" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Create New Element" })).toBeInTheDocument();
    expect(await screen.findByText("Unable to load saved Characters.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /red lantern/i })).toBeInTheDocument();
  });

  it("keeps the characters section usable when elements fail to load", async () => {
    vi.mocked(fetchElementsManagerList).mockRejectedValueOnce(new Error("element failure"));

    render(<VideoPropertiesPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 1" }));

    expect(await screen.findByRole("button", { name: "Create New Character" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Create New Element" })).toBeInTheDocument();
    expect(await screen.findByText("Unable to load saved Elements.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /taylor/i })).toBeInTheDocument();
  });

  it("uses the neutral linked video asset subtitle in the picker", async () => {
    render(<VideoPropertiesPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 1" }));

    expect(
      await screen.findByText(
        "Select a saved Character or Element for the linked video asset slots."
      )
    ).toBeInTheDocument();
  });

  it("opens the elements picker and attaches a saved element to a Kling slot", async () => {
    const onKlingElementsChange = vi.fn();
    render(<VideoPropertiesPanel {...baseProps} onKlingElementsChange={onKlingElementsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 1" }));
    expect(screen.getByRole("dialog", { name: "Choose Characters/Elements" })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /red lantern/i }));

    await waitFor(() => {
      expect(onKlingElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({
          slotIndex: 0,
          sourceKind: "element",
          sourceElementId: "element-red-lantern",
          sourceCharacterId: null,
          name: "Red Lantern",
          alias: "redlantern",
          profileImageTransform: { zoom: 1.35, offsetX: 8, offsetY: -6 },
          frontalImageUrl: "https://example.com/red-lantern-01.jpg",
          referenceImageUrls:
            "https://example.com/red-lantern-02.jpg, https://example.com/red-lantern-03.jpg",
        }),
      ]);
    });
  });

  it("attaches a saved character to a Kling slot through the combined picker", async () => {
    const onKlingElementsChange = vi.fn();
    render(<VideoPropertiesPanel {...baseProps} onKlingElementsChange={onKlingElementsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 1" }));
    fireEvent.click(await screen.findByRole("button", { name: /taylor/i }));

    await waitFor(() => {
      expect(onKlingElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({
          slotIndex: 0,
          sourceKind: "character",
          sourceElementId: null,
          sourceCharacterId: "character-taylor",
          name: "Taylor",
          alias: "",
          frontalImageUrl: "https://example.com/taylor-01.jpg",
          referenceImageUrls:
            "https://example.com/taylor-02.jpg, https://example.com/taylor-03.jpg",
        }),
      ]);
    });
  });

  it("attaches a saved element when its usable media lives in deck references", async () => {
    vi.mocked(loadElementManagerDraftByElementId).mockResolvedValueOnce({
      elementId: "element-deck-only",
      name: "Deck Orchid",
      alias: "deckorchid",
      status: "ready",
      profileImageUrl: "https://example.com/deck-orchid-profile.jpg",
      profileImageTransform: { zoom: 1.12, offsetX: 2, offsetY: -4 },
      description: "Deck-backed orchid",
      assetType: "image",
      imageReferenceUrls: [
        "https://example.com/deck-orchid-01.jpg",
        "https://example.com/deck-orchid-02.jpg",
      ],
      videoReferenceUrl: null,
      updatedAt: "2026-04-07T00:00:00.000Z",
      userId: "user-1",
    });
    const onKlingElementsChange = vi.fn();
    render(<VideoPropertiesPanel {...baseProps} onKlingElementsChange={onKlingElementsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 1" }));
    fireEvent.click(await screen.findByRole("button", { name: /red lantern/i }));

    await waitFor(() => {
      expect(onKlingElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({
          slotIndex: 0,
          sourceKind: "element",
          sourceElementId: "element-deck-only",
          sourceCharacterId: null,
          name: "Deck Orchid",
          alias: "deckorchid",
          frontalImageUrl: "https://example.com/deck-orchid-01.jpg",
          referenceImageUrls: "https://example.com/deck-orchid-02.jpg",
        }),
      ]);
    });
  });

  it("applies the saved crop framing in the elements picker avatar and attached slot preview", async () => {
    const { container } = render(
      <VideoPropertiesPanel
        {...baseProps}
        klingElements={[
          {
            id: "element-red-lantern",
            slotIndex: 0,
            sourceElementId: "element-red-lantern",
            name: "Red Lantern",
            alias: "redlantern",
            description: "",
            profileImageUrl: "https://example.com/red-lantern-profile.jpg",
            profileImageTransform: { zoom: 1.35, offsetX: 8, offsetY: -6 },
            frontalImageUrl: "",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ]}
      />
    );

    const slotPreview = container.querySelector(
      ".video-elements-slot-avatar-image"
    ) as HTMLDivElement | null;
    if (!slotPreview) {
      throw new Error("Expected an attached element preview image.");
    }
    expect(slotPreview).toHaveStyle(
      buildElementProfileImageBackgroundStyle(
        "https://example.com/red-lantern-profile.jpg",
        { zoom: 1.35, offsetX: 8, offsetY: -6 },
        68
      ) as Record<string, unknown>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 2" }));

    const elementsList = await screen.findByRole("list", { name: "Elements options" });
    const redLanternCard = within(elementsList)
      .getByRole("button", { name: /red lantern/i })
      .closest("article");
    const pickerAvatar = redLanternCard?.querySelector(".ai-character-list-avatar-image");
    if (!(pickerAvatar instanceof HTMLElement)) {
      throw new Error("Expected a picker avatar element.");
    }
    expect(pickerAvatar).toHaveStyle(
      buildElementProfileImageBackgroundStyle(
        "https://example.com/red-lantern-profile.jpg",
        { zoom: 1.35, offsetX: 8, offsetY: -6 },
        44
      ) as Record<string, unknown>
    );
  });

  it("shows selected picker chips for entities already attached in other Kling slots", async () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        klingElements={[
          {
            id: "element-red-lantern",
            slotIndex: 0,
            sourceKind: "element",
            sourceElementId: "element-red-lantern",
            sourceCharacterId: null,
            name: "Red Lantern",
            alias: "redlantern",
            description: "",
            profileImageUrl: "https://example.com/red-lantern-profile.jpg",
            profileImageTransform: { zoom: 1.35, offsetX: 8, offsetY: -6 },
            frontalImageUrl: "",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 2" }));

    const elementsList = await screen.findByRole("list", { name: "Elements options" });
    const redLanternCard = await within(elementsList).findByRole("button", {
      name: /red lantern/i,
    });
    expect(redLanternCard.closest("article")).toHaveClass("is-active");
    expect(within(redLanternCard).getByText("Selected")).toBeInTheDocument();
  });

  it("marks picker prompt tokens by source kind for popup styling", async () => {
    render(<VideoPropertiesPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 1" }));

    const charactersList = await screen.findByRole("list", { name: "Characters options" });
    const elementsList = await screen.findByRole("list", { name: "Elements options" });

    expect(within(charactersList).getByText("@taylor")).toHaveClass(
      "ai-character-list-token",
      "ai-character-list-token--character"
    );
    expect(within(elementsList).getByText("@redlantern")).toHaveClass(
      "ai-character-list-token",
      "ai-character-list-token--element"
    );
  });

  it("clears orphaned saved elements that no longer resolve from persistence", async () => {
    vi.mocked(loadElementManagerDraftByElementId).mockRejectedValueOnce(new Error("missing"));
    const onKlingElementsChange = vi.fn();

    render(
      <VideoPropertiesPanel
        {...baseProps}
        klingElements={[
          {
            id: "ghost-element",
            slotIndex: 0,
            sourceElementId: "missing-element",
            name: "Mantis",
            alias: "mantis",
            description: "",
            profileImageUrl: "https://example.com/ghost-profile.jpg",
            frontalImageUrl: "",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ]}
        onKlingElementsChange={onKlingElementsChange}
      />
    );

    await waitFor(() => {
      expect(onKlingElementsChange).toHaveBeenCalledWith([]);
    });
  });

  it("preserves attached saved elements across remount when persistence no longer returns usable media", async () => {
    vi.mocked(loadElementManagerDraftByElementId).mockResolvedValueOnce({
      elementId: "element-red-lantern",
      name: "Red Lantern",
      alias: "redlantern",
      status: "ready",
      profileImageUrl: "https://example.com/red-lantern-profile.jpg",
      profileImageTransform: { zoom: 1.35, offsetX: 8, offsetY: -6 },
      description: "Warm lacquered lantern",
      assetType: "image",
      imageReferenceUrls: [],
      videoReferenceUrl: null,
      updatedAt: "2026-04-07T00:00:00.000Z",
      userId: "user-1",
    });
    const onKlingElementsChange = vi.fn();

    render(
      <VideoPropertiesPanel
        {...baseProps}
        onKlingElementsChange={onKlingElementsChange}
        klingElements={[
          {
            id: "element-red-lantern",
            slotIndex: 0,
            sourceKind: "element",
            sourceElementId: "element-red-lantern",
            sourceCharacterId: null,
            name: "Red Lantern",
            alias: "redlantern",
            description: "",
            profileImageUrl: "https://example.com/red-lantern-profile.jpg",
            profileImageTransform: { zoom: 1.35, offsetX: 8, offsetY: -6 },
            frontalImageUrl: "https://example.com/red-lantern-01.jpg",
            referenceImageUrls: "https://example.com/red-lantern-02.jpg",
            videoUrl: "",
          },
        ]}
      />
    );

    await waitFor(() => {
      expect(loadElementManagerDraftByElementId).toHaveBeenCalledWith("element-red-lantern");
    });
    expect(onKlingElementsChange).not.toHaveBeenCalledWith([]);
    expect(
      screen.getByRole("button", { name: "Replace attached element Red Lantern" })
    ).toBeInTheDocument();
  });

  it("does not pass agent enhance behavior into the video prompt surface", () => {
    render(<VideoPropertiesPanel {...baseProps} />);

    const promptProps = referencePromptStepMock.mock.calls[0]?.[0] as
      | { agentIsSending?: boolean; agentError?: string; onAgentEnhanceSend?: unknown }
      | undefined;
    expect(promptProps?.agentIsSending).toBe(false);
    expect(promptProps?.agentError).toBeUndefined();
    expect(promptProps?.onAgentEnhanceSend).toBeUndefined();
    expect(screen.getByRole("button", { name: /generate/i })).not.toHaveAttribute("aria-busy");
  });

  it("writes Kling element token drag data for attached tiles", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        klingElements={[
          {
            id: "element-01",
            slotIndex: 0,
            sourceElementId: "element-red-lantern",
            name: "Taylor",
            alias: "taylor",
            description: "Lead performer",
            profileImageUrl: "https://example.com/taylor-profile.jpg",
            frontalImageUrl: "https://example.com/taylor-01.jpg",
            referenceImageUrls: "https://example.com/taylor-02.jpg",
            videoUrl: "",
          },
        ]}
      />
    );

    const transfer = createTransferStore();
    const tile = screen.getByLabelText("Replace attached element Taylor");
    fireEvent.dragStart(tile.closest(".video-elements-placeholder-tile--filled") as HTMLElement, {
      dataTransfer: transfer,
    });

    expect(transfer.setData).toHaveBeenCalledWith(
      KLING_ELEMENT_PROMPT_TOKEN_TRANSFER_MIME,
      "@element1"
    );
    expect(transfer.setData).toHaveBeenCalledWith("text/prompt", "@element1");
    expect(transfer.setData).toHaveBeenCalledWith("text/plain", "@element1");
  });

  it("writes Kling character token drag data for attached character tiles", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        klingElements={[
          {
            id: "character-01",
            slotIndex: 0,
            sourceKind: "character",
            sourceCharacterId: "character-taylor",
            sourceElementId: null,
            name: "Taylor",
            alias: "",
            description: "Lead performer",
            profileImageUrl: "https://example.com/taylor-profile.jpg",
            frontalImageUrl: "https://example.com/taylor-01.jpg",
            referenceImageUrls: "https://example.com/taylor-02.jpg",
            videoUrl: "",
          },
        ]}
      />
    );

    const transfer = createTransferStore();
    const tile = screen.getByLabelText("Replace attached element Taylor");
    fireEvent.dragStart(tile.closest(".video-elements-placeholder-tile--filled") as HTMLElement, {
      dataTransfer: transfer,
    });

    expect(transfer.setData).toHaveBeenCalledWith(
      KLING_ELEMENT_PROMPT_TOKEN_TRANSFER_MIME,
      "@element1"
    );
    expect(transfer.setData).toHaveBeenCalledWith("text/prompt", "@element1");
    expect(transfer.setData).toHaveBeenCalledWith("text/plain", "@element1");
  });

  it("removes an attached Kling slot when clicking the trash button", () => {
    const onKlingElementsChange = vi.fn();
    render(
      <VideoPropertiesPanel
        {...baseProps}
        onKlingElementsChange={onKlingElementsChange}
        klingElements={[
          {
            id: "character-01",
            slotIndex: 0,
            sourceKind: "character",
            sourceCharacterId: "character-taylor",
            sourceElementId: null,
            name: "Taylor",
            alias: "",
            description: "Lead performer",
            profileImageUrl: "https://example.com/taylor-profile.jpg",
            frontalImageUrl: "https://example.com/taylor-01.jpg",
            referenceImageUrls: "https://example.com/taylor-02.jpg",
            videoUrl: "",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove attached element Taylor" }));

    expect(onKlingElementsChange).toHaveBeenCalledWith([]);
  });

  it("keeps slot 1 stable when slot 0 is deleted from a sparse Kling slot layout", async () => {
    render(<KlingSparseSlotHarness />);

    expect(screen.getAllByRole("button", { name: "Remove attached element Taylor" })).toHaveLength(
      2
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Remove attached element Taylor" })[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add element to slot 1" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Remove attached element Taylor" })
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: "Replace attached element Taylor" })
      ).toHaveLength(1);
    });
  });

  it("allows deleting the remaining higher-slot Kling entity after slot 0 was cleared", async () => {
    render(<KlingSparseSlotHarness />);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove attached element Taylor" })[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add element to slot 1" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove attached element Red Lantern" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add element to slot 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add element to slot 2" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Remove attached element Red Lantern" })
      ).toBeNull();
    });
  });

  it("inserts a dragged Kling alias token at the video prompt caret", async () => {
    render(<KlingPromptDropHarness />);

    const promptInput = screen.getByLabelText("Video prompt") as HTMLTextAreaElement;
    promptInput.focus();
    promptInput.setSelectionRange(6, 6);

    const transfer = createTransferStore();
    const tile = screen.getByLabelText("Replace attached element Taylor");
    await act(async () => {
      fireEvent.dragStart(tile.closest(".video-elements-placeholder-tile--filled") as HTMLElement, {
        dataTransfer: transfer,
      });
      fireEvent.drop(promptInput, { dataTransfer: transfer });
    });

    await waitFor(() => {
      expect(promptInput.value).toBe("Taylor @element1 walks forward");
    });
  });

  it("replaces the primary video prompt when a prompt card is dropped", async () => {
    render(<KlingPromptDropHarness />);

    const promptInput = screen.getByLabelText("Video prompt") as HTMLTextAreaElement;
    const transfer = createTransferStore();
    transfer.setData("text/prompt", "Dropped primary video prompt");
    transfer.setData("text/plain", "Dropped primary video prompt");

    await act(async () => {
      fireEvent.drop(promptInput, { dataTransfer: transfer });
    });

    await waitFor(() => {
      expect(promptInput.value).toBe("Dropped primary video prompt");
    });
  });
});
