import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceKlingAdvancedSteps } from "../ReferenceKlingAdvancedSteps";

const baseProps: React.ComponentProps<typeof ReferenceKlingAdvancedSteps> = {
  isKling3Mode: true,
  isKieKlingModel: true,
  workflowLabel: "Kling 3.0",
  assetReferenceNoun: "element",
  supportsVoiceControls: false,
  supportsNegativePrompt: false,
  supportsCfgScale: true,
  klingAdvancedOrder: 4,
  klingAssetsOrder: 5,
  klingGuidanceOrder: 6,
  collapsedKlingAdvanced: true,
  collapsedKlingAssets: false,
  collapsedKlingGuidance: true,
  klingShotSummary: "No shots",
  klingAssetsSummary: "1 element · Prompt links ready",
  klingGuidanceSummary: "CFG 0.50 · Neg prompt empty",
  klingShotType: "customize",
  klingMultiPrompts: [],
  klingElements: [],
  klingVoiceIds: ["", ""],
  klingCfgScale: 0.5,
  klingNegativePrompt: "",
  onExpandKlingAdvanced: vi.fn(),
  onExpandKlingAssets: vi.fn(),
  onExpandKlingGuidance: vi.fn(),
  onToggleKlingAdvanced: vi.fn(),
  onToggleKlingAssets: vi.fn(),
  onToggleKlingGuidance: vi.fn(),
  onKlingShotTypeChange: vi.fn(),
  onKlingVoiceIdChange: vi.fn(),
  onKlingCfgScaleChange: vi.fn(),
  onKlingNegativePromptChange: vi.fn(),
  onInsertKlingElementToken: vi.fn(),
  onOpenKlingElementPicker: vi.fn(),
  addKlingShot: vi.fn(),
  removeKlingShot: vi.fn(),
  updateKlingMultiPrompt: vi.fn(),
  addKlingElement: vi.fn(),
  removeKlingElement: vi.fn(),
  updateKlingElement: vi.fn(),
};

describe("ReferenceKlingAdvancedSteps", () => {
  it("does not render static provider-dollar launch cost copy", () => {
    render(<ReferenceKlingAdvancedSteps {...baseProps} collapsedKlingAdvanced={false} />);

    expect(screen.queryByText(/Cost:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Launch limit:/)).not.toBeInTheDocument();
  });

  it("renders sparse model-visible element slots without exposing hidden Seedance image refs", () => {
    const onOpenKlingElementPicker = vi.fn();
    render(
      <ReferenceKlingAdvancedSteps
        {...baseProps}
        onOpenKlingElementPicker={onOpenKlingElementPicker}
        klingElements={[
          null,
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
          null,
        ]}
      />
    );

    expect(screen.queryByText("Image reference")).not.toBeInTheDocument();
    expect(screen.getByText("Red Lantern")).toBeInTheDocument();
    expect(screen.getByText("@redlantern")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Add saved entity" }));

    expect(onOpenKlingElementPicker).toHaveBeenCalledWith(0);
  });
});
