/**
 * VideoPropertiesPanel inline warning tests.
 * Verifies the Kling standard-mode reference-image warning near the generate row.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VideoPropertiesPanel } from "../VideoPropertiesPanel";

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
    isBusy,
    cost,
  }: {
    onClick: () => void;
    disabled?: boolean;
    isBusy?: boolean;
    cost?: number | string | null;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-busy={isBusy}>
      Generate {String(cost ?? "")}
    </button>
  ),
}));

vi.mock("../ReferenceMediaStep", () => ({
  ReferenceMediaStep: () => <div data-testid="reference-media-step" />,
}));

vi.mock("../ReferencePromptStep", () => ({
  ReferencePromptStep: () => <div data-testid="reference-prompt-step" />,
}));

vi.mock("../ReferenceVideoSettingsStep", () => ({
  ReferenceVideoSettingsStep: () => <div data-testid="reference-video-settings-step" />,
}));

vi.mock("../ReferenceKlingAdvancedSteps", () => ({
  ReferenceKlingAdvancedSteps: () => <div data-testid="reference-kling-advanced-steps" />,
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
  useReferencePropertiesDerivedState: () => ({
    activeVideoMode: "standard",
    isKling3Mode: true,
    isKeyframesMode: false,
    isMotionMode: false,
    isStandardMode: true,
    isSeedanceModel: false,
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
  }),
}));

const baseProps: React.ComponentProps<typeof VideoPropertiesPanel> = {
  aspect: "16:9",
  modelId: "kie-ai/kling-3.0",
  modelLabel: "Kling 3.0 (Kie)",
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
  onSave: vi.fn(),
  onRegenerate: vi.fn(),
};

describe("VideoPropertiesPanel", () => {
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
});
