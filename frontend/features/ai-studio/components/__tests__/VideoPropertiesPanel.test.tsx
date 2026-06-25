/**
 * VideoPropertiesPanel inline warning tests.
 * Verifies the Kling standard-mode reference-image warning near the generate row.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import {
  resolveKlingSinglePromptEffectiveVisibleCharacterLimit,
  resolveKlingSinglePromptVisibleCharacterLimit,
} from "../../logic/klingShotModePromptComposition";
import {
  createCanvasTearOutComposerTargetRegistry,
  type CanvasTearOutPoint,
} from "../../hooks/useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";
import { createEmptyLipSyncAudioState } from "../../logic/lipSyncAudioState";
import {
  clearInternalReferenceDragSession,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
  registerInternalReferenceDragSession,
} from "../../../../lib/internalReferenceDragSession";
import { INTERNAL_REFERENCE_DRAG_ORIGIN } from "../../../../lib/internalReferenceDragPayload";

const getSignedMediaUrlMock = vi.hoisted(() => vi.fn());

type ReferencePromptStepMockProps = {
  referenceText?: string | null;
  onPromptTextChange?: (value: string) => void;
  onSave?: () => void;
  onDrop?: (event: React.DragEvent<HTMLTextAreaElement>) => void;
  promptTextareaRef?: React.Ref<HTMLTextAreaElement>;
  promptPlaceholder?: string;
  promptHelperText?: string;
  promptInlineAction?: React.ReactNode;
  agentIsSending?: boolean;
  agentError?: string;
  onAgentEnhanceSend?: unknown;
};

const referencePromptStepMock = vi.fn((props: ReferencePromptStepMockProps) => {
  return (
    <div data-testid="reference-prompt-step">
      {props.promptInlineAction ? (
        <div data-testid="reference-prompt-inline-action">{props.promptInlineAction}</div>
      ) : null}
    </div>
  );
});
const referenceVideoSettingsStepMock = vi.fn((props: { modelModalContext?: string | null }) => {
  void props;
  return <div data-testid="reference-video-settings-step" />;
});

const setElementRect = (
  element: Element,
  rect: { left: number; top: number; width: number; height: number }
) => {
  const domRect = {
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    toJSON: () => ({}),
  } as DOMRect;
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => domRect,
  });
};

const defaultDerivedState = {
  activeVideoMode: "standard",
  isKling3Mode: true,
  isKlingPatternMode: true,
  isKeyframesMode: false,
  isMotionMode: false,
  isLipSyncMode: false,
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

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: (...args: unknown[]) => getSignedMediaUrlMock(...args),
}));

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
    characterSheetPresets: {
      "1": {
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
      "2": {
        portrait: {
          mediaFileId: "portrait-2",
          storagePath: "user/characters/portrait-2.png",
          previewUrl: "https://example.com/taylor-action-01.jpg",
        },
        close_up: {
          mediaFileId: "close-up-2",
          storagePath: "user/characters/close-up-2.png",
          previewUrl: "https://example.com/taylor-action-02.jpg",
        },
        front_shot: {
          mediaFileId: "front-shot-2",
          storagePath: "user/characters/front-shot-2.png",
          previewUrl: "https://example.com/taylor-action-03.jpg",
        },
      },
    } as never,
    visibleCharacterSheetPresetIds: ["1", "2"],
    characterSheetPresetLabels: { "1": "Main", "2": "Action" } as never,
    characterSheetPresetDescriptions: { "1": "", "2": "Taylor in action look." } as never,
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
  ReferenceMediaStep: (props: {
    topContent?: React.ReactNode;
    isLipSyncMode?: boolean;
    lipSyncAudioSlot?: React.ReactNode;
  }) => (
    <div data-testid="reference-media-step">
      {props.topContent}
      {props.isLipSyncMode && props.lipSyncAudioSlot ? (
        <div className="drop-image-row motion-drop-row video-lip-sync-drop-row">
          <div className="primary-drop">
            <div className="reference-dropzone">
              <span className="dropzone-tag">Character</span>
            </div>
          </div>
          <div className="primary-drop">{props.lipSyncAudioSlot}</div>
        </div>
      ) : null}
    </div>
  ),
}));

vi.mock("../ReferencePromptStep", () => ({
  ReferencePromptStep: (props: ReferencePromptStepMockProps) => {
    referencePromptStepMock(props);
    return (
      <div>
        <textarea
          aria-label="Video prompt"
          ref={props.promptTextareaRef}
          value={props.referenceText ?? ""}
          onChange={(event) => props.onPromptTextChange?.(event.target.value)}
          onDrop={(event) => props.onDrop?.(event)}
          onDragOver={(event) => event.preventDefault()}
        />
        {props.promptInlineAction ? (
          <div data-testid="reference-prompt-inline-action">{props.promptInlineAction}</div>
        ) : null}
      </div>
    );
  },
}));

vi.mock("../ReferenceVideoSettingsStep", () => ({
  ReferenceVideoSettingsStep: (props: { modelModalContext?: string | null }) =>
    referenceVideoSettingsStepMock(props),
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
  useReferencePropertiesInteractions: (params: {
    seedanceElementSlotCount?: number;
    onSeedanceElementMediaSlotChange?: (
      slotIndex: number,
      value: { kind: "image" | "video" | "audio"; url: string; name?: string | null } | null
    ) => void;
  }) => ({
    primaryInputRef: { current: null },
    extraOneInputRef: { current: null },
    extraTwoInputRef: { current: null },
    extraThreeInputRef: { current: null },
    motionVideoInputRef: { current: null },
    seedanceElementImageInputRefs: Array.from(
      { length: params.seedanceElementSlotCount ?? 0 },
      () => ({ current: null })
    ),
    primaryDragActive: false,
    extraDragActive: [false, false, false],
    seedanceElementImageDragActive: Array.from(
      { length: params.seedanceElementSlotCount ?? 0 },
      () => false
    ),
    primaryImageLoading: false,
    extraImageLoading: [false, false, false],
    seedanceElementImageLoading: Array.from(
      { length: params.seedanceElementSlotCount ?? 0 },
      () => false
    ),
    setSeedanceElementImageDragActiveAt: vi.fn(),
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
    handleSeedanceElementMediaFileSelection:
      (slotIndex: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const isVideo = file?.type.startsWith("video/");
        const isAudio = file?.type.startsWith("audio/");
        params.onSeedanceElementMediaSlotChange?.(
          slotIndex,
          file
            ? {
                kind: isVideo ? "video" : isAudio ? "audio" : "image",
                url: `blob:seedance-slot-${slotIndex}`,
                name: file.name,
              }
            : null
        );
      },
    handleSeedanceElementMediaDrop:
      (slotIndex: number) => (event: React.DragEvent<HTMLDivElement>) => {
        const url =
          event.dataTransfer.getData("text/uri-list") ||
          event.dataTransfer.getData("text/plain") ||
          `https://example.com/seedance-slot-${slotIndex}.png`;
        params.onSeedanceElementMediaSlotChange?.(slotIndex, {
          kind: url.endsWith(".mp4") ? "video" : url.endsWith(".mp3") ? "audio" : "image",
          url,
        });
      },
    handleSeedanceElementMediaDragEnter: vi.fn(() => vi.fn()),
    handleSeedanceElementMediaDragOver: vi.fn(() => vi.fn()),
    handleSeedanceElementMediaDragLeave: vi.fn(() => vi.fn()),
    acceptPrimaryCanvasTearOutPayload: vi.fn(),
    acceptExtraCanvasTearOutPayload: vi.fn(),
    acceptSeedanceElementMediaCanvasTearOutPayload: vi.fn(
      (slotIndex: number, payload: AgentComposerDirectDropPayload) => {
        const imageUrl =
          payload.kind === "image"
            ? (payload.composerImagePayload?.displayArtifactUrl ??
              payload.internalPayload?.referenceRenderUrl ??
              payload.internalPayload?.referenceUrl ??
              null)
            : null;
        const videoUrl = payload.kind === "video" ? payload.videoUrl : null;
        const audioPayload = payload.kind === "audio" ? payload : null;
        const audioUrl = audioPayload?.audioUrl ?? null;
        params.onSeedanceElementMediaSlotChange?.(
          slotIndex,
          imageUrl
            ? { kind: "image", url: imageUrl }
            : videoUrl
              ? { kind: "video", url: videoUrl }
              : audioUrl
                ? { kind: "audio", url: audioUrl, name: audioPayload?.title }
                : null
        );
      }
    ),
    acceptMotionVideoCanvasTearOutPayload: vi.fn(),
    allowVideoDrag: vi.fn(() => false),
    handleMotionVideoDrop: vi.fn(),
    handleMotionVideoSelection: vi.fn(),
  }),
}));

vi.mock("../useReferencePropertiesDerivedState", () => ({
  useReferencePropertiesDerivedState: () => useReferencePropertiesDerivedStateMock(),
}));

vi.mock("../MotionRecorderModal", () => ({
  MotionRecorderModal: ({
    isOpen,
    onApplyVideo,
  }: {
    isOpen: boolean;
    onApplyVideo: (
      upload: {
        url: string;
        path: string;
        size: number;
        mimeType: string;
        name: string;
      },
      sourceFile: File
    ) => void | Promise<void>;
  }) =>
    isOpen ? (
      <button
        type="button"
        onClick={() =>
          void onApplyVideo(
            {
              url: "https://example.com/recorded-motion.mp4",
              path: "user/videos/motion-control/recorded-motion.mp4",
              size: 2048,
              mimeType: "video/mp4",
              name: "recorded-motion.mp4",
            },
            new File(["recorded"], "recorded-motion.webm", { type: "video/webm" })
          )
        }
      >
        Apply recorded motion clip
      </button>
    ) : null,
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
  const types: string[] = [];
  return {
    effectAllowed: "copy",
    dropEffect: "copy",
    types,
    files: [],
    setData: vi.fn((type: string, value: string) => {
      store[type] = value;
      if (!types.includes(type)) types.push(type);
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

const attachTransferFiles = (transfer: DataTransfer, files: File[]) => {
  Object.defineProperty(transfer, "files", {
    configurable: true,
    value: files,
  });
  const mutableTypes = transfer.types as unknown as string[];
  if (!mutableTypes.includes("Files")) mutableTypes.push("Files");
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

function SeedanceReferenceModeHarness({
  referenceImageUrl = null,
  extraImageUrls = [null, null, null] as [string | null, string | null, string | null],
  initialInputMode = "multimodal" as "text" | "first-frame" | "first-last" | "multimodal",
}: {
  referenceImageUrl?: string | null;
  extraImageUrls?: [string | null, string | null, string | null];
  initialInputMode?: "text" | "first-frame" | "first-last" | "multimodal";
}) {
  const [seedance2InputMode, setSeedance2InputMode] = React.useState(initialInputMode);

  return (
    <>
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        referenceImageUrl={referenceImageUrl}
        extraImageUrls={extraImageUrls}
        seedance2InputMode={seedance2InputMode}
        onSeedance2InputModeChange={setSeedance2InputMode}
      />
      <div data-testid="seedance-input-mode">{seedance2InputMode}</div>
    </>
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

function KlingElementAttachHarness({
  onCommit,
}: {
  onCommit?: (elements: AiStudioKlingElement[]) => void;
}) {
  const [klingElements, setKlingElements] = React.useState<AiStudioKlingElement[]>([]);
  const handleKlingElementsChange = (next: AiStudioKlingElement[]) => {
    onCommit?.(next);
    setKlingElements(next);
  };

  return (
    <VideoPropertiesPanel
      {...baseProps}
      klingElements={klingElements}
      onKlingElementsChange={handleKlingElementsChange}
    />
  );
}

function KlingInitialElementHarness() {
  const [klingElements, setKlingElements] = React.useState<AiStudioKlingElement[]>([
    {
      id: "element-red-lantern",
      slotIndex: 0,
      sourceKind: "element",
      sourceElementId: "element-red-lantern",
      sourceCharacterId: null,
      name: "Red Lantern",
      alias: "redlantern",
      description: "Warm lacquered lantern",
      profileImageUrl: "https://signed.example.com/red-lantern-profile.jpg?token=old",
      profileImageTransform: { zoom: 1.35, offsetX: 8, offsetY: -6 },
      frontalImageUrl: "https://signed.example.com/red-lantern-01.jpg?token=old",
      referenceImageUrls: "https://signed.example.com/red-lantern-02.jpg?token=old",
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
    getSignedMediaUrlMock.mockReset();
    referencePromptStepMock.mockClear();
    referenceVideoSettingsStepMock.mockClear();
    useReferencePropertiesDerivedStateMock.mockReset();
    useReferencePropertiesDerivedStateMock.mockReturnValue(defaultDerivedState);
    vi.mocked(listCharacterManagerCharacters).mockClear();
    vi.mocked(loadCharacterManagerDraftByCharacterId).mockClear();
    vi.mocked(fetchElementsManagerList).mockClear();
    vi.mocked(loadElementManagerDraftByElementId).mockClear();
  });

  it("supports keyboard navigation on the shared video mode tabs", () => {
    const onVideoReferenceModeChange = vi.fn();
    render(
      <VideoPropertiesPanel
        {...baseProps}
        onVideoReferenceModeChange={onVideoReferenceModeChange}
      />
    );

    const modeTabs = screen.getByRole("tablist", { name: "Video reference mode" });
    expect(screen.getByRole("tab", { name: "Standard" })).toHaveAttribute("tabIndex", "0");
    expect(screen.getByRole("tab", { name: "Motion Control" })).toHaveAttribute("tabIndex", "-1");

    fireEvent.keyDown(modeTabs, { key: "ArrowRight" });

    expect(onVideoReferenceModeChange).toHaveBeenCalledWith("motion");
  });

  it("supports keyboard navigation on the Kling shot mode tabs", () => {
    render(<KlingModeStateHarness />);

    const shotTabs = screen.getByRole("tablist", { name: "Video structure" });
    expect(screen.getByTestId("kling-mode-state")).toHaveTextContent("custom");

    fireEvent.keyDown(shotTabs, { key: "ArrowLeft" });

    expect(screen.getByTestId("kling-mode-state")).toHaveTextContent("single");
  });

  it("supports keyboard navigation on Seedance input type tabs", () => {
    render(<SeedanceReferenceModeHarness />);

    const referenceTabs = screen.getByRole("tablist", { name: "Seedance input type" });

    fireEvent.keyDown(referenceTabs, { key: "End" });
    expect(screen.getByTestId("seedance-input-mode")).toHaveTextContent("text");

    fireEvent.keyDown(referenceTabs, { key: "Home" });
    expect(screen.getByTestId("seedance-input-mode")).toHaveTextContent("multimodal");
  });

  it("shows the Kling reference image warning when both standard frame slots are empty", () => {
    render(<VideoPropertiesPanel {...baseProps} />);

    expect(screen.getByText("Add a start frame to generate with Kling")).toBeInTheDocument();
  });

  it("toggles the shared Styles panel from the video generate actions", () => {
    const onStylesPanelToggle = vi.fn();
    const { rerender } = render(
      <VideoPropertiesPanel
        {...baseProps}
        isStylesPanelOpen={false}
        onStylesPanelToggle={onStylesPanelToggle}
      />
    );

    const stylesButton = screen.getByRole("button", { name: "Styles" });
    expect(stylesButton).toHaveAttribute("aria-expanded", "false");
    expect(stylesButton.closest(".video-right-generate-actions")).not.toBeNull();
    expect(stylesButton.closest('[data-testid="reference-prompt-inline-action"]')).toBeNull();

    fireEvent.click(stylesButton);
    expect(onStylesPanelToggle).toHaveBeenCalledTimes(1);

    rerender(
      <VideoPropertiesPanel
        {...baseProps}
        isStylesPanelOpen
        onStylesPanelToggle={onStylesPanelToggle}
      />
    );
    expect(screen.getByRole("button", { name: "Styles" })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the selected style preview on the video Styles button", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        selectedStyleId="video-style"
        stylesCatalog={[
          {
            id: "video-style",
            title: "Video Style",
            stylePrompt: "cinematic grade",
            previewUrl: "/Styles/Cinematic.png",
            placeholder: false,
          },
        ]}
      />
    );

    const stylesButton = screen.getByRole("button", { name: "Styles" });
    const preview = stylesButton.querySelector(
      ".edit-expert-styles-btn-preview"
    ) as HTMLSpanElement | null;
    expect(stylesButton).toHaveClass("has-selected-style");
    expect(preview?.style.backgroundImage).toContain("/Styles/Cinematic.png");
  });

  it("places add references below video settings in Standard video setup", () => {
    render(<VideoPropertiesPanel {...baseProps} />);

    const settingsStep = screen.getByTestId("reference-video-settings-step");
    const referenceStep = screen.getByTestId("reference-media-step");

    expect(settingsStep.compareDocumentPosition(referenceStep)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("keeps the Motion Control recorder prompt above motion reference drops", () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "motion",
      isMotionMode: true,
      isStandardMode: false,
      referenceStepTitle: "Add Motion Inputs",
      referenceStepSubtitle: "Add motion inputs",
    });

    render(
      <VideoPropertiesPanel {...baseProps} videoReferenceMode="motion" motionVideoUrl={null} />
    );

    const recorderPrompt = screen.getByText("Need a clip?");
    const referenceStep = screen.getByTestId("reference-media-step");

    expect(recorderPrompt.compareDocumentPosition(referenceStep)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("shows Kling element slots in Motion Control without showing shot mode controls", () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "motion",
      isMotionMode: true,
      isStandardMode: false,
      referenceStepTitle: "Add Motion Inputs",
      referenceStepSubtitle: "Add motion inputs",
    });

    render(
      <VideoPropertiesPanel
        {...baseProps}
        videoReferenceMode="motion"
        motionVideoUrl={null}
        klingElements={[
          {
            id: "element-1",
            slotIndex: 0,
            sourceKind: "element",
            sourceElementId: "element-1",
            sourceCharacterId: null,
            name: "Red Lantern",
            alias: "redlantern",
            description: "Warm lacquered lantern",
            profileImageUrl: "https://example.com/red-lantern.png",
            profileImageTransform: null,
            frontalImageUrl: "https://example.com/red-lantern-front.png",
            referenceImageUrls: "https://example.com/red-lantern-side.png",
            videoUrl: "",
          },
        ]}
      />
    );

    expect(screen.getByText("Elements")).toBeInTheDocument();
    expect(screen.getByLabelText("Element reference slots")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Replace attached element Red Lantern/ })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("reference-kling-advanced-steps")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Single shot" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Multi-shot" })).not.toBeInTheDocument();
  });

  it("routes recorded Motion Control clips through the recorded-video bridge", async () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "motion",
      isMotionMode: true,
      isStandardMode: false,
      referenceStepTitle: "Add Motion Inputs",
      referenceStepSubtitle: "Add motion inputs",
    });
    const onRecordedMotionVideoReady = vi.fn(async () => undefined);
    const onStageMotionVideoSelection = vi.fn(async () => undefined);

    render(
      <VideoPropertiesPanel
        {...baseProps}
        videoReferenceMode="motion"
        motionVideoUrl={null}
        onRecordedMotionVideoReady={onRecordedMotionVideoReady}
        onStageMotionVideoSelection={onStageMotionVideoSelection}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open motion recorder to add a motion clip" })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Apply recorded motion clip" }));

    await waitFor(() =>
      expect(onRecordedMotionVideoReady).toHaveBeenCalledWith(
        {
          url: "https://example.com/recorded-motion.mp4",
          path: "user/videos/motion-control/recorded-motion.mp4",
          size: 2048,
          mimeType: "video/mp4",
          name: "recorded-motion.mp4",
        },
        expect.any(File)
      )
    );
    expect(onStageMotionVideoSelection).not.toHaveBeenCalled();
  });

  it("registers the primary prompt composer as a Canvas tear-out text target", async () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    const onPromptTextChange = vi.fn();
    const promptPayload: AgentComposerDirectDropPayload = {
      kind: "text",
      text: "Canvas prompt",
    };
    const promptPoint: CanvasTearOutPoint = { clientX: 40, clientY: 40 };

    render(
      <VideoPropertiesPanel
        {...baseProps}
        referenceText="Existing direction "
        onPromptTextChange={onPromptTextChange}
        canvasTearOutTargetRegistry={registry}
      />
    );

    const promptTextarea = screen.getByLabelText("Video prompt");
    const promptShell = promptTextarea.closest(".video-primary-prompt-shell") as HTMLElement;
    expect(promptShell).toBeTruthy();
    setElementRect(promptShell, { left: 10, top: 10, width: 360, height: 160 });

    await waitFor(() =>
      expect(registry.resolveTargetAtPoint(promptPoint, promptPayload)?.id).toBe(
        "video-primary-prompt-composer"
      )
    );

    const promptTarget = registry.resolveTargetAtPoint(promptPoint, promptPayload);
    act(() => {
      promptTarget?.target.setActive?.(true);
    });
    await waitFor(() =>
      expect(
        screen.getByLabelText("Video prompt").closest(".video-primary-prompt-shell")
      ).toHaveClass("is-dragging")
    );
    act(() => {
      promptTarget?.target.setActive?.(false);
    });
    await waitFor(() =>
      expect(
        screen.getByLabelText("Video prompt").closest(".video-primary-prompt-shell")
      ).not.toHaveClass("is-dragging")
    );

    act(() => {
      registry.resolveTargetAtPoint(promptPoint, promptPayload)?.target.accept(promptPayload);
    });
    expect(onPromptTextChange).toHaveBeenCalledWith("Existing direction Canvas prompt");
  });

  it("registers the Lip Sync audio slot as a Canvas tear-out audio target", async () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isMotionMode: false,
      referenceStepTitle: "Character image",
      referenceStepSubtitle: "Add a character image.",
      promptBadge: "Prompt optional",
    });
    const registry = createCanvasTearOutComposerTargetRegistry();
    const onLipSyncAudioChange = vi.fn();
    const audioPayload: AgentComposerDirectDropPayload = {
      kind: "audio",
      audioUrl: "https://example.com/canvas-voice.mp3",
      internalPayload: null,
      outputId: "audio-output-1",
      mediaId: "media-audio-1",
      durationMs: 12000,
      audioSourceMode: "voiceover",
    };
    const audioPoint: CanvasTearOutPoint = { clientX: 40, clientY: 40 };

    const { container } = render(
      <VideoPropertiesPanel
        {...baseProps}
        canvasTearOutTargetRegistry={registry}
        onLipSyncAudioChange={onLipSyncAudioChange}
      />
    );

    const audioDropzone = container.querySelector(".video-lip-sync-audio-dropzone");
    expect(audioDropzone).not.toBeNull();
    setElementRect(audioDropzone as Element, { left: 10, top: 10, width: 360, height: 120 });

    await waitFor(() =>
      expect(registry.resolveTargetAtPoint(audioPoint, audioPayload)?.id).toBe(
        "video-lip-sync-audio"
      )
    );
    expect(
      registry.resolveTargetAtPoint(audioPoint, { kind: "text", text: "Not audio" })
    ).toBeNull();

    const audioTarget = registry.resolveTargetAtPoint(audioPoint, audioPayload);
    act(() => {
      audioTarget?.target.setActive?.(true);
    });
    await waitFor(() => expect(audioDropzone).toHaveClass("is-dragging"));
    act(() => {
      audioTarget?.target.setActive?.(false);
    });
    await waitFor(() => expect(audioDropzone).not.toHaveClass("is-dragging"));

    act(() => {
      registry.resolveTargetAtPoint(audioPoint, audioPayload)?.target.accept(audioPayload);
    });
    expect(onLipSyncAudioChange).toHaveBeenCalledWith({
      url: "https://example.com/canvas-voice.mp3",
      durationMs: 12000,
      status: "ready",
      sourceKind: "canvas",
      storagePath: null,
      previewUrl: null,
      mimeType: null,
      size: null,
    });
  });

  it("uses durable internal audio from Canvas tear-out when the visible audio URL is local", async () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isMotionMode: false,
      referenceStepTitle: "Character image",
      referenceStepSubtitle: "Add a character image.",
      promptBadge: "Prompt optional",
    });
    const registry = createCanvasTearOutComposerTargetRegistry();
    const onLipSyncAudioChange = vi.fn();
    const audioPayload: AgentComposerDirectDropPayload = {
      kind: "audio",
      audioUrl: "blob:https://www.shortpulse.ai/local-audio-preview",
      audioStoragePath: "user-1/audio/audio-reference.mp3",
      internalPayload: {
        version: 1,
        origin: "ai-studio-reference-grid",
        referenceId: "audio-output-1",
        outputId: "audio-output-1",
        imageIndex: 0,
        mediaId: "media-audio-1",
        mediaKind: "audio",
        referenceUrl: "https://signed.shortpulse.test/audio-reference.mp3",
        referenceRenderUrl: "blob:https://www.shortpulse.ai/local-audio-preview",
        fullStoragePath: "user-1/audio/audio-reference.mp3",
        sourceSurface: "all-refs",
        sessionBacked: true,
      },
      outputId: "audio-output-1",
      mediaId: "media-audio-1",
      durationMs: 30000,
      audioSourceMode: "voiceover",
    };
    const audioPoint: CanvasTearOutPoint = { clientX: 40, clientY: 40 };

    const { container } = render(
      <VideoPropertiesPanel
        {...baseProps}
        canvasTearOutTargetRegistry={registry}
        onLipSyncAudioChange={onLipSyncAudioChange}
      />
    );

    const audioDropzone = container.querySelector(".video-lip-sync-audio-dropzone");
    expect(audioDropzone).not.toBeNull();
    setElementRect(audioDropzone as Element, { left: 10, top: 10, width: 360, height: 120 });

    await waitFor(() =>
      expect(registry.resolveTargetAtPoint(audioPoint, audioPayload)?.id).toBe(
        "video-lip-sync-audio"
      )
    );

    act(() => {
      registry.resolveTargetAtPoint(audioPoint, audioPayload)?.target.accept(audioPayload);
    });
    expect(onLipSyncAudioChange).toHaveBeenCalledWith({
      url: "https://signed.shortpulse.test/audio-reference.mp3",
      durationMs: 30000,
      status: "ready",
      sourceKind: "canvas",
      storagePath: "user-1/audio/audio-reference.mp3",
      previewUrl: null,
      mimeType: null,
      size: null,
    });
  });

  it("uses internal audio storage authority from Canvas tear-out when no durable URL is available", async () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isMotionMode: false,
      referenceStepTitle: "Character image",
      referenceStepSubtitle: "Add a character image.",
      promptBadge: "Prompt optional",
    });
    const registry = createCanvasTearOutComposerTargetRegistry();
    const onLipSyncAudioChange = vi.fn();
    const audioPayload: AgentComposerDirectDropPayload = {
      kind: "audio",
      audioUrl: "blob:https://www.shortpulse.ai/local-audio-preview",
      audioStoragePath: "user-1/audio/audio-reference.mp3",
      internalPayload: {
        version: 1,
        origin: "ai-studio-reference-grid",
        referenceId: "audio-output-1",
        outputId: "audio-output-1",
        imageIndex: 0,
        mediaId: "media-audio-1",
        mediaKind: "audio",
        referenceUrl: "blob:https://www.shortpulse.ai/local-audio-preview",
        referenceRenderUrl: "blob:https://www.shortpulse.ai/local-audio-preview",
        sourceSurface: "all-refs",
        sessionBacked: true,
      },
      outputId: "audio-output-1",
      mediaId: "media-audio-1",
      durationMs: 30000,
      audioSourceMode: "voiceover",
    };
    const audioPoint: CanvasTearOutPoint = { clientX: 40, clientY: 40 };

    const { container } = render(
      <VideoPropertiesPanel
        {...baseProps}
        canvasTearOutTargetRegistry={registry}
        onLipSyncAudioChange={onLipSyncAudioChange}
      />
    );

    const audioDropzone = container.querySelector(".video-lip-sync-audio-dropzone");
    expect(audioDropzone).not.toBeNull();
    setElementRect(audioDropzone as Element, { left: 10, top: 10, width: 360, height: 120 });

    await waitFor(() =>
      expect(registry.resolveTargetAtPoint(audioPoint, audioPayload)?.id).toBe(
        "video-lip-sync-audio"
      )
    );

    act(() => {
      registry.resolveTargetAtPoint(audioPoint, audioPayload)?.target.accept(audioPayload);
    });
    expect(onLipSyncAudioChange).toHaveBeenCalledWith({
      url: null,
      durationMs: 30000,
      status: "ready",
      sourceKind: "canvas",
      storagePath: "user-1/audio/audio-reference.mp3",
      previewUrl: null,
      mimeType: null,
      size: null,
    });
  });

  it("preserves Media Library audio storage path for Lip Sync submit authority", async () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isMotionMode: false,
      referenceStepTitle: "Character image",
      referenceStepSubtitle: "Add a character image.",
      promptBadge: "Prompt optional",
    });
    const onLipSyncAudioChange = vi.fn();
    const transfer = createTransferStore();
    transfer.setData(
      "application/x-shortpulse-media-library-item",
      JSON.stringify({
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: "media-audio-1",
          url: "https://signed.shortpulse.test/voice-preview.mp3",
          fullUrl: "https://signed.shortpulse.test/voice-full.mp3",
          fileType: "audio",
          filename: "tree there 2.mp3",
          fullStoragePath: "user-1/audio/reference-grid/voice-full.mp3",
          previewStoragePath: "user-1/audio/reference-grid/voice-preview.mp3",
          durationMs: 12400,
        },
      })
    );

    const { container } = render(
      <VideoPropertiesPanel {...baseProps} onLipSyncAudioChange={onLipSyncAudioChange} />
    );

    const audioDropzone = container.querySelector(".video-lip-sync-audio-dropzone");
    expect(audioDropzone).not.toBeNull();
    fireEvent.drop(audioDropzone as Element, { dataTransfer: transfer });

    await waitFor(() =>
      expect(onLipSyncAudioChange).toHaveBeenCalledWith({
        url: "https://signed.shortpulse.test/voice-full.mp3",
        title: "tree there 2.mp3",
        durationMs: 12400,
        status: "ready",
        sourceKind: "library",
        storagePath: "user-1/audio/reference-grid/voice-full.mp3",
        previewUrl: null,
        mimeType: null,
        size: null,
      })
    );
    expect(getSignedMediaUrlMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/audio/reference-grid/voice-full.mp3",
      previewProfile: "none",
    });
  });

  it("accepts Reference Grid audio drops for Lip Sync voice audio", async () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isMotionMode: false,
      referenceStepTitle: "Character image",
      referenceStepSubtitle: "Add a character image.",
      promptBadge: "Prompt optional",
    });
    const onLipSyncAudioChange = vi.fn();
    const transfer = createTransferStore();
    transfer.setData("text/reference-origin", "ai-studio-reference-grid");
    transfer.setData("text/reference-id", "audio-output-1");
    transfer.setData("text/reference-output-id", "audio-output-1");
    transfer.setData("text/reference-media-id", "media-audio-1");
    transfer.setData("text/reference-media-kind", "audio");
    transfer.setData("text/reference-url", "https://signed.shortpulse.test/reference-voice.mp3");
    transfer.setData("text/prompt", "tree there 2.mp3");
    transfer.setData(
      "text/reference-full-storage-path",
      "user-1/audio/reference-grid/reference-voice.mp3"
    );

    const { container } = render(
      <VideoPropertiesPanel {...baseProps} onLipSyncAudioChange={onLipSyncAudioChange} />
    );

    const audioDropzone = container.querySelector(".video-lip-sync-audio-dropzone");
    expect(audioDropzone).not.toBeNull();
    fireEvent.drop(audioDropzone as Element, { dataTransfer: transfer });

    await waitFor(() =>
      expect(onLipSyncAudioChange).toHaveBeenCalledWith({
        url: "https://signed.shortpulse.test/reference-voice.mp3",
        title: "tree there 2.mp3",
        durationMs: null,
        status: "ready",
        sourceKind: "reference",
        storagePath: "user-1/audio/reference-grid/reference-voice.mp3",
        previewUrl: null,
        mimeType: null,
        size: null,
      })
    );
    expect(getSignedMediaUrlMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/audio/reference-grid/reference-voice.mp3",
      previewProfile: "none",
    });
  });

  it("keeps Reference Grid audio authority ahead of synthetic browser files", async () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isMotionMode: false,
      referenceStepTitle: "Character image",
      referenceStepSubtitle: "Add a character image.",
      promptBadge: "Prompt optional",
    });
    const onLipSyncAudioChange = vi.fn();
    const transfer = createTransferStore();
    transfer.setData("text/reference-origin", "ai-studio-reference-grid");
    transfer.setData("text/reference-id", "audio-output-1");
    transfer.setData("text/reference-output-id", "audio-output-1");
    transfer.setData("text/reference-media-kind", "audio");
    transfer.setData("text/reference-url", "https://signed.shortpulse.test/reference-voice.mp3");
    transfer.setData(
      "text/reference-full-storage-path",
      "user-1/audio/reference-grid/reference-voice.mp3"
    );
    attachTransferFiles(transfer, [
      new File(["synthetic"], "browser-synthetic-audio.mp3", { type: "audio/mpeg" }),
    ]);

    const { container } = render(
      <VideoPropertiesPanel {...baseProps} onLipSyncAudioChange={onLipSyncAudioChange} />
    );

    const audioDropzone = container.querySelector(".video-lip-sync-audio-dropzone");
    expect(audioDropzone).not.toBeNull();
    fireEvent.drop(audioDropzone as Element, { dataTransfer: transfer });

    await waitFor(() =>
      expect(onLipSyncAudioChange).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://signed.shortpulse.test/reference-voice.mp3",
          sourceKind: "reference",
          storagePath: "user-1/audio/reference-grid/reference-voice.mp3",
          status: "ready",
        })
      )
    );
    expect(onLipSyncAudioChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceKind: "local" })
    );
  });

  it("resolves degraded Reference Grid audio by id before using synthetic files", async () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isMotionMode: false,
      referenceStepTitle: "Character image",
      referenceStepSubtitle: "Add a character image.",
      promptBadge: "Prompt optional",
    });
    const onLipSyncAudioChange = vi.fn();
    const transfer = createTransferStore();
    transfer.setData("text/reference-origin", "ai-studio-reference-grid");
    transfer.setData("text/reference-id", "audio-output-1");
    transfer.setData("text/reference-output-id", "audio-output-1");
    transfer.setData("text/reference-media-kind", "audio");
    attachTransferFiles(transfer, [
      new File(["synthetic"], "browser-synthetic-audio.mp3", { type: "audio/mpeg" }),
    ]);

    const { container } = render(
      <VideoPropertiesPanel
        {...baseProps}
        onLipSyncAudioChange={onLipSyncAudioChange}
        resolvePreviewUrlById={(id) =>
          id === "audio-output-1" ? "https://signed.shortpulse.test/id-voice.mp3" : null
        }
      />
    );

    const audioDropzone = container.querySelector(".video-lip-sync-audio-dropzone");
    expect(audioDropzone).not.toBeNull();
    fireEvent.drop(audioDropzone as Element, { dataTransfer: transfer });

    await waitFor(() =>
      expect(onLipSyncAudioChange).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://signed.shortpulse.test/id-voice.mp3",
          sourceKind: "reference",
          storagePath: null,
          status: "ready",
        })
      )
    );
    expect(onLipSyncAudioChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceKind: "local" })
    );
  });

  it("ignores non-audio local file drops in the Lip Sync voice slot", async () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isMotionMode: false,
      referenceStepTitle: "Character image",
      referenceStepSubtitle: "Add a character image.",
      promptBadge: "Prompt optional",
    });
    const onLipSyncAudioChange = vi.fn();
    const transfer = createTransferStore();
    attachTransferFiles(transfer, [new File(["image"], "not-audio.png", { type: "image/png" })]);

    const { container } = render(
      <VideoPropertiesPanel {...baseProps} onLipSyncAudioChange={onLipSyncAudioChange} />
    );

    const audioDropzone = container.querySelector(".video-lip-sync-audio-dropzone");
    expect(audioDropzone).not.toBeNull();
    fireEvent.drop(audioDropzone as Element, { dataTransfer: transfer });

    await act(async () => {
      await Promise.resolve();
    });
    expect(onLipSyncAudioChange).not.toHaveBeenCalled();
  });

  it("keeps Lip Sync Canvas tear-out blocked when audio has only a local preview", async () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isMotionMode: false,
      referenceStepTitle: "Character image",
      referenceStepSubtitle: "Add a character image.",
      promptBadge: "Prompt optional",
    });
    const registry = createCanvasTearOutComposerTargetRegistry();
    const onLipSyncAudioChange = vi.fn();
    const audioPayload: AgentComposerDirectDropPayload = {
      kind: "audio",
      audioUrl: "blob:https://www.shortpulse.ai/local-audio-preview",
      internalPayload: null,
      outputId: "audio-output-1",
      mediaId: "media-audio-1",
      durationMs: 30000,
      audioSourceMode: "voiceover",
    };
    const audioPoint: CanvasTearOutPoint = { clientX: 40, clientY: 40 };

    const { container } = render(
      <VideoPropertiesPanel
        {...baseProps}
        canvasTearOutTargetRegistry={registry}
        onLipSyncAudioChange={onLipSyncAudioChange}
      />
    );

    const audioDropzone = container.querySelector(".video-lip-sync-audio-dropzone");
    expect(audioDropzone).not.toBeNull();
    setElementRect(audioDropzone as Element, { left: 10, top: 10, width: 360, height: 120 });

    await waitFor(() =>
      expect(registry.resolveTargetAtPoint(audioPoint, audioPayload)?.id).toBe(
        "video-lip-sync-audio"
      )
    );

    act(() => {
      registry.resolveTargetAtPoint(audioPoint, audioPayload)?.target.accept(audioPayload);
    });
    expect(onLipSyncAudioChange).toHaveBeenCalledWith({
      url: null,
      durationMs: null,
      status: "failed",
      sourceKind: null,
      previewUrl: "blob:https://www.shortpulse.ai/local-audio-preview",
      error: "Local voice audio is no longer available. Re-add the audio file and try again.",
    });
  });

  it("renders Lip Sync setup with product-only language", () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isStandardMode: false,
      referenceStepTitle: "Character image",
      referenceStepSubtitle: "Add a character image",
      resolutionOptions: [
        { value: "720p", label: "720p" },
        { value: "1080p", label: "1080p" },
      ],
      videoResolutionValue: "1080p",
    });

    const { container } = render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId="fal-ai/bytedance/omnihuman/v1.5"
        modelLabel="Fal OmniHuman"
        referenceText=""
        videoReferenceMode="lip-sync"
        lipSyncAudio={createEmptyLipSyncAudioState()}
        onLipSyncAudioChange={vi.fn()}
        onLipSyncTurboModeChange={vi.fn()}
      />
    );

    expect(screen.getByRole("tab", { name: "Lip Sync" })).toBeInTheDocument();
    expect(screen.getByText("Lip Sync Settings")).toBeInTheDocument();
    expect(screen.getByText("Add Lip Sync Inputs")).toBeInTheDocument();
    expect(screen.getAllByText("Voice audio").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Lip Sync resolution" })).toHaveTextContent("1080p");
    expect(screen.queryByRole("button", { name: "720p" })).toBeNull();
    expect(screen.queryByRole("button", { name: "1080p" })).toBeNull();
    expect(screen.queryByText("Faster generation")).toBeNull();
    expect(screen.queryByRole("switch", { name: "Faster generation" })).toBeNull();
    const lipSyncInputRow = container.querySelector(".video-lip-sync-drop-row");
    expect(lipSyncInputRow?.children[0]).toHaveClass("primary-drop");
    expect(lipSyncInputRow?.children[1]).toHaveClass("primary-drop");
    expect(lipSyncInputRow?.children[0]).toHaveTextContent("Character");
    expect(lipSyncInputRow?.children[1]).toHaveTextContent("Voice audio");
    expect(screen.queryByText(/Kling/i)).toBeNull();
    expect(screen.queryByTestId("reference-video-settings-step")).toBeNull();
    const summaryPanel = screen.getByLabelText("Current video settings");
    expect(within(summaryPanel).getByText("Mode")).toBeInTheDocument();
    expect(within(summaryPanel).getByText("Lip Sync")).toBeInTheDocument();
    expect(within(summaryPanel).queryByText("Shot")).toBeNull();
    expect(within(summaryPanel).queryByText("Voice audio")).toBeNull();
    expect(document.body).not.toHaveTextContent(/Fal|OmniHuman|Bytedance|fal-ai\/bytedance/i);
  });

  it("routes Lip Sync resolution selection through the video resolution setter", () => {
    const onVideoResolutionChange = vi.fn();
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isStandardMode: false,
      referenceStepTitle: "Character image",
      resolutionOptions: [
        { value: "720p", label: "720p" },
        { value: "1080p", label: "1080p" },
      ],
      videoResolutionValue: "1080p",
    });

    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId="fal-ai/bytedance/omnihuman/v1.5"
        modelLabel="Lip Sync"
        videoReferenceMode="lip-sync"
        onVideoResolutionChange={onVideoResolutionChange}
      />
    );

    const resolutionTrigger = screen.getByRole("button", { name: "Lip Sync resolution" });
    expect(resolutionTrigger).toHaveTextContent("1080p");
    fireEvent.click(resolutionTrigger);
    expect(resolutionTrigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("option", { name: "720p" }));
    expect(onVideoResolutionChange).toHaveBeenCalledWith("720p");
  });

  it("hides the duration pill in the Lip Sync voice audio dropzone", () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isStandardMode: false,
      referenceStepTitle: "Character image",
      referenceStepSubtitle: "Add a character image",
      resolutionOptions: [{ value: "720p", label: "720p" }],
      videoResolutionValue: "720p",
    });

    const { container } = render(
      <VideoPropertiesPanel
        {...baseProps}
        videoReferenceMode="lip-sync"
        lipSyncAudio={{
          url: "https://signed.shortpulse.test/voice-reference.mp3",
          durationMs: 6_000,
          status: "ready",
          sourceKind: "reference",
        }}
        onLipSyncAudioChange={vi.fn()}
      />
    );

    const audioDropzone = container.querySelector(".video-lip-sync-audio-dropzone");
    expect(audioDropzone).not.toBeNull();
    expect(audioDropzone?.querySelector(".reference-card-audio-duration-badge")).toBeNull();
    expect(audioDropzone).not.toHaveTextContent("0:06");
  });

  it("shows the selected Lip Sync voice audio title in the dropzone", () => {
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isStandardMode: false,
      referenceStepTitle: "Character image",
      referenceStepSubtitle: "Add a character image",
      resolutionOptions: [{ value: "720p", label: "720p" }],
      videoResolutionValue: "720p",
    });

    const { container } = render(
      <VideoPropertiesPanel
        {...baseProps}
        videoReferenceMode="lip-sync"
        lipSyncAudio={{
          url: "https://signed.shortpulse.test/voice-reference.mp3",
          title: "tree there 2.mp3",
          durationMs: 6_000,
          status: "ready",
          sourceKind: "reference",
        }}
        onLipSyncAudioChange={vi.fn()}
      />
    );

    const audioDropzone = container.querySelector(".video-lip-sync-audio-dropzone");
    expect(audioDropzone).not.toBeNull();
    expect(audioDropzone?.querySelector(".reference-card-audio-title")).toHaveTextContent(
      "tree there 2.mp3"
    );
  });

  it("hides the deferred Lip Sync faster-generation switch", () => {
    const onLipSyncTurboModeChange = vi.fn();
    useReferencePropertiesDerivedStateMock.mockReturnValue({
      ...defaultDerivedState,
      activeVideoMode: "lip-sync",
      isKling3Mode: false,
      isKlingPatternMode: false,
      isLipSyncMode: true,
      isStandardMode: false,
      referenceStepTitle: "Character image",
      videoResolutionValue: "1080p",
    });

    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId="fal-ai/bytedance/omnihuman/v1.5"
        modelLabel="Lip Sync"
        videoReferenceMode="lip-sync"
        lipSyncTurboMode={false}
        onLipSyncTurboModeChange={onLipSyncTurboModeChange}
      />
    );

    expect(screen.queryByText("Faster generation")).toBeNull();
    expect(screen.queryByRole("switch", { name: "Faster generation" })).toBeNull();
    expect(onLipSyncTurboModeChange).not.toHaveBeenCalled();
  });

  it("keeps the Kling reference image warning visible when only the last-frame slot has an image", () => {
    const { rerender } = render(<VideoPropertiesPanel {...baseProps} />);

    rerender(
      <VideoPropertiesPanel
        {...baseProps}
        extraImageUrls={["https://example.com/last-frame.jpg", null, null]}
      />
    );

    expect(screen.getByText("Add a start frame to generate with Kling")).toBeInTheDocument();
  });

  it("hides the Kling reference image warning once the first frame is populated", () => {
    const { rerender } = render(<VideoPropertiesPanel {...baseProps} />);

    rerender(
      <VideoPropertiesPanel
        {...baseProps}
        referenceImageUrl="https://example.com/first-frame.jpg"
      />
    );

    expect(screen.queryByText("Add a start frame to generate with Kling")).toBeNull();
  });

  it("keeps the model picker in reference-video context when Standard mode has both frames populated", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        videoReferenceMode="standard"
        referenceImageUrl="https://example.com/first.png"
        extraImageUrls={["https://example.com/last.png", null, null]}
        modelId={KIE_KLING_30_MODEL_ID}
        modelLabel="Kling 3.0"
      />
    );

    expect(referenceVideoSettingsStepMock).toHaveBeenCalled();
    const latestProps =
      referenceVideoSettingsStepMock.mock.calls[
        referenceVideoSettingsStepMock.mock.calls.length - 1
      ]?.[0];
    expect(latestProps?.modelModalContext).toBe("reference-video");
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

  it("enables Generate in Motion Control when character and motion references are present without prompt text", () => {
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
        referenceText=""
        referenceImageUrl="https://example.com/character-reference.png"
        motionVideoUrl="https://example.com/motion-reference.mp4"
        isGenerateDisabled={false}
      />
    );

    expect(screen.getByRole("button", { name: /Generate/ })).not.toBeDisabled();
    const summaryPanel = screen.getByLabelText("Current video settings");
    expect(within(summaryPanel).getByText("Mode")).toBeInTheDocument();
    expect(within(summaryPanel).getByText("Motion Control")).toBeInTheDocument();
    expect(within(summaryPanel).queryByText("Shot")).toBeNull();
    expect(within(summaryPanel).queryByText("Single")).toBeNull();
  });

  it("maps stale Kling custom mode to the Multi tab without custom shot controls", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        referenceText=""
        klingWorkflowMode="custom"
        klingMultiPrompts={[
          { id: "shot-1", prompt: "Beat one", duration: 5 },
          { id: "shot-2", prompt: "Beat two", duration: 5 },
        ]}
        onKlingMultiPromptsChange={vi.fn()}
      />
    );

    expect(screen.getByRole("tab", { name: "Multi-shot" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.queryByRole("tab", { name: "Custom multi-shot" })).toBeNull();
    expect(screen.queryByText("Shot 2")).toBeNull();
    expect(screen.queryByLabelText("Add another shot prompt")).toBeNull();
  });

  it("keeps the compact Kling settings shot mode selector to Single and Multi only", () => {
    render(<VideoPropertiesPanel {...baseProps} klingWorkflowMode="single" />);

    const settingsCard = screen.getByText("Elements").closest(".step-card");
    expect(settingsCard).not.toBeNull();
    const settings = within(settingsCard as HTMLElement);

    expect(settings.getByRole("tab", { name: "Single shot" })).toBeInTheDocument();
    expect(settings.getByRole("tab", { name: "Multi-shot" })).toBeInTheDocument();
    expect(settings.queryByRole("tab", { name: "Custom multi-shot" })).toBeNull();
    expect(settings.queryByText("Custom")).toBeNull();
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

    expect(screen.queryByText("Seedance 2 is currently unavailable in the U.S.")).toBeNull();
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

    expect(
      screen.getByText(
        `1,250 / ${resolveKlingSinglePromptVisibleCharacterLimit("single").toLocaleString()}`
      )
    ).toBeInTheDocument();
  });

  it("pins the current video composer prompt as a text reference while preserving the counter slot", () => {
    const onPinPromptReference = vi.fn();
    const promptText = "  dolly backward through the forest  ";

    render(
      <VideoPropertiesPanel
        {...baseProps}
        referenceText={promptText}
        onPinPromptReference={onPinPromptReference}
      />
    );

    expect(
      screen.getByText(
        `${promptText.length.toLocaleString()} / ${resolveKlingSinglePromptVisibleCharacterLimit(
          "single"
        ).toLocaleString()}`
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pin text reference to reference grid" }));

    expect(onPinPromptReference).toHaveBeenCalledWith("dolly backward through the forest");
  });

  it("does not render the video composer pin button for an empty prompt", () => {
    render(
      <VideoPropertiesPanel {...baseProps} referenceText="   " onPinPromptReference={vi.fn()} />
    );

    expect(
      screen.queryByRole("button", { name: "Pin text reference to reference grid" })
    ).toBeNull();
  });

  it("blocks generate when the Kling single-shot prompt exceeds the effective visible limit", () => {
    const effectiveLimit = resolveKlingSinglePromptVisibleCharacterLimit("single");
    render(
      <VideoPropertiesPanel
        {...baseProps}
        referenceImageUrl="https://example.com/first-frame.jpg"
        referenceText={"A".repeat(effectiveLimit + 1)}
      />
    );

    expect(
      screen.getByText(
        `Prompt exceeds Kling's effective ${effectiveLimit.toLocaleString()} character limit after hidden shot-mode direction is applied.`
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
  });

  it("uses the stricter effective visible limit for Kling Multi mode", () => {
    const effectiveLimit = resolveKlingSinglePromptVisibleCharacterLimit("multi");
    render(
      <VideoPropertiesPanel
        {...baseProps}
        referenceImageUrl="https://example.com/first-frame.jpg"
        klingWorkflowMode="multi"
        referenceText={"A".repeat(effectiveLimit + 1)}
      />
    );

    expect(
      screen.getByText(
        `Prompt exceeds Kling's effective ${effectiveLimit.toLocaleString()} character limit after hidden shot-mode direction is applied.`
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
  });

  it("shrinks the effective visible limit when attached Kling elements will be auto-appended", () => {
    const klingElements: AiStudioKlingElement[] = [
      {
        id: "element-01",
        slotIndex: 0,
        name: "Taylor",
        alias: "taylor",
        profileImageUrl: "https://example.com/taylor-profile.jpg",
        frontalImageUrl: "https://example.com/taylor-01.jpg",
        referenceImageUrls: "https://example.com/taylor-02.jpg",
        videoUrl: "",
      },
    ];
    const effectiveLimit = resolveKlingSinglePromptEffectiveVisibleCharacterLimit({
      prompt: "A",
      mode: "single",
      klingElements,
    });

    render(
      <VideoPropertiesPanel
        {...baseProps}
        referenceImageUrl="https://example.com/first-frame.jpg"
        referenceText={"A".repeat(effectiveLimit + 1)}
        klingElements={klingElements}
      />
    );

    expect(
      screen.getByText(
        `Prompt exceeds Kling's effective ${effectiveLimit.toLocaleString()} character limit after hidden shot-mode direction is applied.`
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
  });

  it("uses the Multi prompt counter when stale Kling custom mode is present", () => {
    const effectiveLimit = resolveKlingSinglePromptEffectiveVisibleCharacterLimit({
      prompt: "A",
      mode: "multi",
      klingElements: [],
    });

    render(
      <VideoPropertiesPanel
        {...baseProps}
        referenceImageUrl="https://example.com/first-frame.jpg"
        referenceText={"A".repeat(120)}
        klingWorkflowMode="custom"
        klingMultiPrompts={[
          { id: "shot-1", prompt: "Stale shot one", duration: 5 },
          { id: "shot-2", prompt: "Stale shot two", duration: 5 },
        ]}
        onKlingMultiPromptsChange={vi.fn()}
      />
    );

    expect(screen.getByText(`120 / ${effectiveLimit.toLocaleString()}`)).toBeInTheDocument();
    expect(screen.queryByText("Stale shot two")).toBeNull();
  });

  it("ignores stale custom shot prompt limits after custom controls are removed", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        referenceImageUrl="https://example.com/first-frame.jpg"
        referenceText="Valid single prompt"
        klingWorkflowMode="custom"
        klingMultiPrompts={[
          { id: "shot-1", prompt: "A".repeat(120), duration: 5 },
          { id: "shot-2", prompt: "B".repeat(501), duration: 5 },
        ]}
        onKlingMultiPromptsChange={vi.fn()}
      />
    );

    expect(screen.queryByText("Shot prompt exceeds Kling's 500 character limit.")).toBeNull();
    expect(screen.getByRole("button", { name: /generate/i })).not.toBeDisabled();
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

    expect(screen.queryByRole("tab", { name: "Custom multi-shot" })).toBeNull();
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
        modelLabel="Seedance 2 Fast"
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
        modelLabel="Seedance 2"
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

  it("renders the compact Seedance input toggle with Assets first", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
      />
    );

    const referenceModeTabs = within(
      screen.getByRole("tablist", { name: "Seedance input type" })
    ).getAllByRole("tab");
    expect(referenceModeTabs.map((tab) => tab.textContent)).toEqual(["Assets", "Frames"]);
    expect(screen.getByRole("tab", { name: "Assets" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Frames" })).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByTestId("reference-media-step")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Element reference slots")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Add element to slot/ })).toHaveLength(9);
  });

  it("marks the Seedance settings card for the elevated video panel shadow", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
      />
    );

    const settingsCard = screen.getByText("Seedance 2 Settings").closest(".step-card");
    expect(settingsCard).not.toBeNull();
    expect(settingsCard).toHaveClass("video-elements-card--seedance");
  });

  it("uploads a direct image reference into a Seedance Elements slot", () => {
    const onKlingElementsChange = vi.fn();
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        onKlingElementsChange={onKlingElementsChange}
      />
    );

    const fileInput = document.querySelector(
      'input[type="file"][accept="image/*,video/*,audio/*"]'
    );
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [new File(["seedance"], "seedance.png", { type: "image/png" })],
      },
    });

    expect(onKlingElementsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        slotIndex: 0,
        sourceKind: "reference-image",
        frontalImageUrl: "blob:seedance-slot-0",
        profileImageUrl: "blob:seedance-slot-0",
      }),
    ]);
  });

  it("uploads a direct video reference into a Seedance Elements slot", () => {
    const onKlingElementsChange = vi.fn();
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        onKlingElementsChange={onKlingElementsChange}
      />
    );

    const fileInput = document.querySelector(
      'input[type="file"][accept="image/*,video/*,audio/*"]'
    );
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [new File(["seedance"], "seedance.mp4", { type: "video/mp4" })],
      },
    });

    expect(onKlingElementsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        slotIndex: 0,
        sourceKind: "reference-video",
        name: "seedance.mp4",
        videoUrl: "blob:seedance-slot-0",
      }),
    ]);
  });

  it("uploads a direct audio reference into a Seedance Elements slot", () => {
    const onKlingElementsChange = vi.fn();
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        onKlingElementsChange={onKlingElementsChange}
      />
    );

    const fileInput = document.querySelector(
      'input[type="file"][accept="image/*,video/*,audio/*"]'
    );
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [new File(["seedance"], "seedance.mp3", { type: "audio/mpeg" })],
      },
    });

    expect(onKlingElementsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        slotIndex: 0,
        sourceKind: "reference-audio",
        name: "seedance.mp3",
        audioUrl: "blob:seedance-slot-0",
      }),
    ]);
  });

  it("warns instead of adding a fourth Seedance audio reference", () => {
    const onKlingElementsChange = vi.fn();
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        onKlingElementsChange={onKlingElementsChange}
        klingElements={Array.from({ length: 3 }, (_, index) => ({
          id: `audio-${index + 1}`,
          slotIndex: index,
          sourceKind: "reference-audio" as const,
          sourceElementId: null,
          sourceCharacterId: null,
          name: `Audio reference ${index + 1}`,
          alias: "",
          description: "",
          profileImageUrl: null,
          profileImageTransform: null,
          frontalImageUrl: "",
          referenceImageUrls: "",
          videoUrl: "",
          audioUrl: `https://example.com/audio-${index + 1}.mp3`,
        }))}
      />
    );

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"][accept="image/*,video/*,audio/*"]'
    );
    fireEvent.change(fileInputs[3], {
      target: {
        files: [new File(["seedance"], "seedance-four.mp3", { type: "audio/mpeg" })],
      },
    });

    expect(screen.getByText("Seedance 2 supports up to 3 audio references.")).toBeInTheDocument();
    expect(onKlingElementsChange).not.toHaveBeenCalled();
  });

  it("warns instead of adding a fourth Seedance video reference", () => {
    const onKlingElementsChange = vi.fn();
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        onKlingElementsChange={onKlingElementsChange}
        klingElements={Array.from({ length: 3 }, (_, index) => ({
          id: `video-${index + 1}`,
          slotIndex: index,
          sourceKind: "reference-video" as const,
          sourceElementId: null,
          sourceCharacterId: null,
          name: `Video reference ${index + 1}`,
          alias: "",
          description: "",
          profileImageUrl: null,
          profileImageTransform: null,
          frontalImageUrl: "",
          referenceImageUrls: "",
          videoUrl: `https://example.com/video-${index + 1}.mp4`,
        }))}
      />
    );

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"][accept="image/*,video/*,audio/*"]'
    );
    fireEvent.change(fileInputs[3], {
      target: {
        files: [new File(["seedance"], "seedance-four.mp4", { type: "video/mp4" })],
      },
    });

    expect(screen.getByText("Seedance 2 supports up to 3 video references.")).toBeInTheDocument();
    expect(onKlingElementsChange).not.toHaveBeenCalled();
  });

  it("warns when rich asset slots already exceed the Seedance image reference budget", () => {
    const onKlingElementsChange = vi.fn();
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        onKlingElementsChange={onKlingElementsChange}
        klingElements={[
          ...Array.from({ length: 8 }, (_, index) => ({
            id: `image-${index + 1}`,
            slotIndex: index,
            sourceKind: "reference-image" as const,
            sourceElementId: null,
            sourceCharacterId: null,
            name: `Image reference ${index + 1}`,
            alias: "",
            description: "",
            profileImageUrl: `https://example.com/image-${index + 1}.png`,
            profileImageTransform: null,
            frontalImageUrl: `https://example.com/image-${index + 1}.png`,
            referenceImageUrls: "",
            videoUrl: "",
          })),
          {
            id: "rich-element",
            slotIndex: 8,
            sourceKind: "element" as const,
            sourceElementId: null,
            sourceCharacterId: null,
            name: "Rich Element",
            alias: "richelement",
            description: "",
            profileImageUrl: "https://example.com/rich-profile.png",
            profileImageTransform: null,
            frontalImageUrl: "https://example.com/rich-front.png",
            referenceImageUrls: "https://example.com/rich-side.png",
            videoUrl: "",
          },
        ]}
      />
    );

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"][accept="image/*,video/*,audio/*"]'
    );
    fireEvent.change(fileInputs[0], {
      target: {
        files: [new File(["seedance"], "seedance-replace.png", { type: "image/png" })],
      },
    });

    expect(screen.getByText("Seedance 2 supports up to 9 image references.")).toBeInTheDocument();
    expect(onKlingElementsChange).not.toHaveBeenCalled();
  });

  it("drops a direct image reference into a Seedance Elements slot", () => {
    const onKlingElementsChange = vi.fn();
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        onKlingElementsChange={onKlingElementsChange}
      />
    );

    const firstSlot = screen
      .getByRole("button", { name: "Add element to slot 1" })
      .closest(".video-elements-placeholder-tile");
    expect(firstSlot).toBeTruthy();

    const transfer = createTransferStore();
    transfer.setData("text/uri-list", "https://example.com/reference-grid-image.png");
    fireEvent.drop(firstSlot as HTMLElement, { dataTransfer: transfer });

    expect(onKlingElementsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        slotIndex: 0,
        sourceKind: "reference-image",
        frontalImageUrl: "https://example.com/reference-grid-image.png",
      }),
    ]);
  });

  it("accepts a canvas tear-out image into a Seedance Elements slot", () => {
    const onKlingElementsChange = vi.fn();
    const registry = createCanvasTearOutComposerTargetRegistry();
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        canvasTearOutTargetRegistry={registry}
        onKlingElementsChange={onKlingElementsChange}
      />
    );

    const firstSlot = screen
      .getByRole("button", { name: "Add element to slot 1" })
      .closest(".video-elements-placeholder-tile");
    expect(firstSlot).toBeTruthy();
    setElementRect(firstSlot as HTMLElement, { left: 0, top: 0, width: 80, height: 80 });

    const payload: AgentComposerDirectDropPayload = {
      kind: "image",
      internalPayload: null,
      composerImagePayload: {
        version: 1,
        origin: "ai-studio-reference-grid",
        referenceId: "canvas-image",
        outputId: "canvas-image",
        mediaId: "media-canvas-image",
        displayArtifactUrl: "https://example.com/canvas-image.png",
        displayArtifactKind: "url",
        referenceUrl: "https://example.com/canvas-image.png",
        sourceSurface: "all-refs",
      },
    };
    const target = registry.resolveTargetAtPoint({ clientX: 20, clientY: 20 }, payload);
    expect(target?.id).toBe("video-seedance-element-media-0");
    target?.target.accept(payload);

    expect(onKlingElementsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        slotIndex: 0,
        sourceKind: "reference-image",
        frontalImageUrl: "https://example.com/canvas-image.png",
      }),
    ]);
  });

  it("accepts a canvas tear-out audio payload into a Seedance Elements slot", () => {
    const onKlingElementsChange = vi.fn();
    const registry = createCanvasTearOutComposerTargetRegistry();
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        canvasTearOutTargetRegistry={registry}
        onKlingElementsChange={onKlingElementsChange}
      />
    );

    const firstSlot = screen
      .getByRole("button", { name: "Add element to slot 1" })
      .closest(".video-elements-placeholder-tile");
    expect(firstSlot).toBeTruthy();
    setElementRect(firstSlot as HTMLElement, { left: 0, top: 0, width: 80, height: 80 });

    const payload: AgentComposerDirectDropPayload = {
      kind: "audio",
      audioUrl: "https://example.com/canvas-voice.mp3",
      title: "Canvas voice",
      internalPayload: null,
    };
    const target = registry.resolveTargetAtPoint({ clientX: 20, clientY: 20 }, payload);
    expect(target?.id).toBe("video-seedance-element-media-0");
    target?.target.accept(payload);

    expect(onKlingElementsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        slotIndex: 0,
        sourceKind: "reference-audio",
        name: "Canvas voice",
        audioUrl: "https://example.com/canvas-voice.mp3",
      }),
    ]);
  });

  it("does not expose direct Seedance image references as prompt-token draggable slots", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        klingElements={[
          {
            id: "direct-image",
            slotIndex: 0,
            sourceKind: "reference-image",
            sourceElementId: null,
            sourceCharacterId: null,
            name: "Image reference",
            alias: "",
            description: "",
            profileImageUrl: "https://example.com/direct-image.png",
            profileImageTransform: null,
            frontalImageUrl: "https://example.com/direct-image.png",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ]}
      />
    );

    const directImageTile = screen
      .getByRole("button", { name: /Replace attached element Image reference/ })
      .closest(".video-elements-placeholder-tile--filled");
    expect(directImageTile).toHaveClass("video-elements-placeholder-tile--reference-image");
    expect(directImageTile).not.toHaveAttribute("draggable", "true");
    expect(screen.queryByRole("button", { name: /Insert @element1/i })).toBeNull();
  });

  it("does not expose direct Seedance video references as prompt-token draggable slots", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        klingElements={[
          {
            id: "direct-video",
            slotIndex: 0,
            sourceKind: "reference-video",
            sourceElementId: null,
            sourceCharacterId: null,
            name: "Video reference",
            alias: "",
            description: "",
            profileImageUrl: null,
            profileImageTransform: null,
            frontalImageUrl: "",
            referenceImageUrls: "",
            videoUrl: "https://example.com/direct-video.mp4",
          },
        ]}
      />
    );

    const directVideoTile = screen
      .getByRole("button", { name: /Replace attached element Video reference/ })
      .closest(".video-elements-placeholder-tile--filled");
    expect(directVideoTile).toHaveClass("video-elements-placeholder-tile--reference-video");
    expect(directVideoTile).not.toHaveAttribute("draggable", "true");
    expect(screen.queryByRole("button", { name: /Insert @element1/i })).toBeNull();
  });

  it("does not expose direct Seedance audio references as prompt-token draggable slots", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        klingElements={[
          {
            id: "direct-audio",
            slotIndex: 0,
            sourceKind: "reference-audio",
            sourceElementId: null,
            sourceCharacterId: null,
            name: "Audio reference",
            alias: "",
            description: "",
            profileImageUrl: null,
            profileImageTransform: null,
            frontalImageUrl: "",
            referenceImageUrls: "",
            videoUrl: "",
            audioUrl: "https://example.com/direct-audio.mp3",
          },
        ]}
      />
    );

    const directAudioTile = screen
      .getByRole("button", { name: /Replace attached element Audio reference/ })
      .closest(".video-elements-placeholder-tile--filled");
    expect(directAudioTile).toHaveClass("video-elements-placeholder-tile--reference-audio");
    expect(directAudioTile).not.toHaveAttribute("draggable", "true");
    expect(screen.queryByRole("button", { name: /Insert @element1/i })).toBeNull();
  });

  it("hides the upload control for filled Seedance image reference slots", () => {
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        klingElements={[
          {
            id: "direct-image",
            slotIndex: 0,
            sourceKind: "reference-image",
            sourceElementId: null,
            sourceCharacterId: null,
            name: "Image reference",
            alias: "",
            description: "",
            profileImageUrl: "https://example.com/direct-image.png",
            profileImageTransform: null,
            frontalImageUrl: "https://example.com/direct-image.png",
            referenceImageUrls: "",
            videoUrl: "",
          },
        ]}
      />
    );

    expect(screen.queryByRole("button", { name: "Upload media reference to slot 1" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove attached element Image reference" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload media reference to slot 2" })
    ).toBeInTheDocument();
  });

  it("hides direct Seedance image references after switching to Kling while preserving them for Seedance", () => {
    const klingElements: AiStudioKlingElement[] = [
      {
        id: "direct-image",
        slotIndex: 0,
        sourceKind: "reference-image",
        sourceElementId: null,
        sourceCharacterId: null,
        name: "Image reference",
        alias: "",
        description: "",
        profileImageUrl: "https://example.com/direct-image.png",
        profileImageTransform: null,
        frontalImageUrl: "https://example.com/direct-image.png",
        referenceImageUrls: "",
        videoUrl: "",
      },
      {
        id: "saved-element",
        slotIndex: 1,
        sourceKind: "element",
        sourceElementId: "element-1",
        sourceCharacterId: null,
        name: "Red Lantern",
        alias: "redlantern",
        description: "Warm lacquered lantern",
        profileImageUrl: "https://example.com/red-lantern.png",
        profileImageTransform: null,
        frontalImageUrl: "https://example.com/red-lantern-front.png",
        referenceImageUrls: "https://example.com/red-lantern-side.png",
        videoUrl: "",
      },
    ];
    const { rerender } = render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        klingElements={klingElements}
      />
    );

    expect(
      screen.getByRole("button", { name: /Replace attached element Image reference/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Replace attached element Red Lantern/ })
    ).toBeInTheDocument();

    rerender(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_KLING_30_MODEL_ID}
        modelLabel="Kling 3.0"
        klingElements={klingElements}
      />
    );

    expect(
      screen.queryByRole("button", { name: /Replace attached element Image reference/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Image reference")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add element to slot 1" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Replace attached element Red Lantern/ })
    ).toBeInTheDocument();

    rerender(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_SEEDANCE_2_MODEL_ID}
        modelLabel="Seedance 2"
        klingElements={klingElements}
      />
    );

    expect(
      screen.getByRole("button", { name: /Replace attached element Image reference/ })
    ).toBeInTheDocument();
  });

  it("switches Seedance input type between frames and assets", () => {
    render(<SeedanceReferenceModeHarness />);

    fireEvent.click(screen.getByRole("tab", { name: "Frames" }));

    expect(screen.getByTestId("seedance-input-mode")).toHaveTextContent("text");
    expect(screen.getByTestId("reference-media-step")).toBeInTheDocument();
    expect(screen.queryByLabelText("Element reference slots")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Assets" }));

    expect(screen.getByTestId("seedance-input-mode")).toHaveTextContent("multimodal");
    expect(screen.getByRole("tab", { name: "Assets" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByTestId("reference-media-step")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Element reference slots")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Add element to slot/i })).toHaveLength(9);
  });

  it("returns Seedance to first-last mode when keyframes are reselected with both frames present", () => {
    render(
      <SeedanceReferenceModeHarness
        initialInputMode="multimodal"
        referenceImageUrl="https://example.com/first-frame.jpg"
        extraImageUrls={["https://example.com/last-frame.jpg", null, null]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Frames" }));

    expect(screen.getByTestId("seedance-input-mode")).toHaveTextContent("first-last");
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
    const charactersList = await screen.findByRole("list", { name: "Characters options" });
    expect(within(charactersList).getByText("Taylor")).toBeInTheDocument();
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

  it("preserves Seedance-only linked slots when editing a visible Kling slot", async () => {
    const onKlingElementsChange = vi.fn();
    const seedanceOnlyElement: AiStudioKlingElement = {
      id: "seedance-slot-five",
      slotIndex: 4,
      sourceKind: "element",
      sourceElementId: "element-seedance-only",
      sourceCharacterId: null,
      sourceCharacterLookId: null,
      sourceCharacterLookLabel: null,
      name: "Seedance Prop",
      alias: "seedanceprop",
      description: "Only visible in Seedance slot five.",
      profileImageUrl: "https://example.com/seedance-prop-profile.jpg",
      profileImageTransform: null,
      frontalImageUrl: "https://example.com/seedance-prop-front.jpg",
      referenceImageUrls: "https://example.com/seedance-prop-side.jpg",
      videoUrl: "",
    };
    render(
      <VideoPropertiesPanel
        {...baseProps}
        modelId={KIE_KLING_30_MODEL_ID}
        modelLabel="Kling 3.0"
        klingElements={[seedanceOnlyElement]}
        onKlingElementsChange={onKlingElementsChange}
      />
    );

    expect(screen.queryByText("Seedance Prop")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 1" }));
    fireEvent.click(await screen.findByRole("button", { name: /red lantern/i }));

    await waitFor(() => {
      expect(onKlingElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({
          slotIndex: 0,
          sourceKind: "element",
          sourceElementId: "element-red-lantern",
          name: "Red Lantern",
        }),
        expect.objectContaining({
          id: "seedance-slot-five",
          slotIndex: 4,
          name: "Seedance Prop",
        }),
      ]);
    });
  });

  it("does not reload a freshly attached saved element after the parent state updates", async () => {
    const onCommit = vi.fn();
    render(<KlingElementAttachHarness onCommit={onCommit} />);

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 1" }));
    fireEvent.click(await screen.findByRole("button", { name: /red lantern/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Replace attached element Red Lantern" })
      ).toBeInTheDocument();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(loadElementManagerDraftByElementId).toHaveBeenCalledTimes(1);
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

  it("attaches the selected saved character look to a Kling slot", async () => {
    const onKlingElementsChange = vi.fn();
    render(<VideoPropertiesPanel {...baseProps} onKlingElementsChange={onKlingElementsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add element to slot 1" }));
    expect(await screen.findByText("Select look")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Choose look for Taylor" }));
    fireEvent.click(await screen.findByRole("option", { name: "Action" }));

    await waitFor(() => {
      expect(onKlingElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({
          slotIndex: 0,
          sourceKind: "character",
          sourceElementId: null,
          sourceCharacterId: "character-taylor",
          sourceCharacterLookId: "2",
          sourceCharacterLookLabel: "Action",
          name: "Taylor",
          description: "Taylor in action look.",
          frontalImageUrl: "https://example.com/taylor-action-01.jpg",
          referenceImageUrls:
            "https://example.com/taylor-action-02.jpg, https://example.com/taylor-action-03.jpg",
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

  it("refreshes a restored saved element once without looping on rotated signed URLs", async () => {
    let loadCount = 0;
    vi.mocked(loadElementManagerDraftByElementId).mockImplementation(async () => {
      loadCount += 1;
      return {
        elementId: "element-red-lantern",
        name: "Red Lantern",
        alias: "redlantern",
        status: "ready",
        profileImageUrl: `https://signed.example.com/red-lantern-profile.jpg?token=fresh-${loadCount}`,
        profileImageTransform: { zoom: 1.35, offsetX: 8, offsetY: -6 },
        description: "Warm lacquered lantern",
        assetType: "image",
        imageReferenceUrls: [
          `https://signed.example.com/red-lantern-01.jpg?token=fresh-${loadCount}`,
          `https://signed.example.com/red-lantern-02.jpg?token=fresh-${loadCount}`,
        ],
        videoReferenceUrl: null,
        updatedAt: "2026-04-07T00:00:00.000Z",
        userId: "user-1",
      };
    });

    render(<KlingInitialElementHarness />);

    await waitFor(() => {
      expect(loadElementManagerDraftByElementId).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(loadElementManagerDraftByElementId).toHaveBeenCalledTimes(1);
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

  it("replaces the primary video prompt with full session-backed prompt reference text", async () => {
    render(<KlingPromptDropHarness />);

    const promptInput = screen.getByLabelText("Video prompt") as HTMLTextAreaElement;
    const fullPrompt = `Opening action. ${"Precise camera and motion direction. ".repeat(80)}Final frame.`;
    const shortenedPrompt = fullPrompt.slice(0, 1000);
    const token = registerInternalReferenceDragSession({
      version: 1,
      origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
      referenceId: "ref-video-long-prompt",
      outputId: "ref-video-long-prompt",
      imageIndex: 0,
      mediaId: null,
      mediaKind: "text",
      promptText: fullPrompt,
      referenceUrl: null,
      sourceSurface: "all-refs",
    });
    const transfer = createTransferStore();
    transfer.setData(INTERNAL_REFERENCE_DRAG_SESSION_TYPE, token);
    transfer.setData(INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE, token);
    transfer.setData("text/reference-media-kind", "text");
    transfer.setData("text/prompt", shortenedPrompt);
    transfer.setData("text/plain", shortenedPrompt);

    await act(async () => {
      fireEvent.drop(promptInput, { dataTransfer: transfer });
    });

    await waitFor(() => {
      expect(promptInput.value).toBe(fullPrompt);
    });

    clearInternalReferenceDragSession(token);
  });

  it("inserts a dropped prompt card at the video prompt caret when Shift is held", async () => {
    render(<KlingPromptDropHarness />);

    const promptInput = screen.getByLabelText("Video prompt") as HTMLTextAreaElement;
    promptInput.focus();
    promptInput.setSelectionRange(6, 6);
    const transfer = createTransferStore();
    transfer.setData("text/prompt", "Dropped primary video prompt");
    transfer.setData("text/plain", "Dropped primary video prompt");

    await act(async () => {
      const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(dropEvent, "dataTransfer", { value: transfer });
      Object.defineProperty(dropEvent, "shiftKey", { value: true });
      fireEvent(promptInput, dropEvent);
    });

    await waitFor(() => {
      expect(promptInput.value).toBe("TaylorDropped primary video prompt walks forward");
    });
  });
});
