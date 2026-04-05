import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceKlingAdvancedSteps } from "../ReferenceKlingAdvancedSteps";

const baseProps = {
  isKling3Mode: true,
  isKieKlingModel: false,
  beginnerMode: false,
  klingAdvancedOrder: 5,
  klingAdvancedBadge: "5",
  klingAssetsOrder: 6,
  klingAssetsBadge: "6",
  klingGuidanceOrder: 7,
  klingGuidanceBadge: "7",
  collapsedKlingAdvanced: true,
  collapsedKlingAssets: false,
  collapsedKlingGuidance: false,
  klingShotSummary: "No shots",
  klingAssetsSummary: "1 element · 1 voice",
  klingGuidanceSummary: "CFG 0.50 · Neg prompt set",
  klingShotType: "customize" as const,
  klingMultiPrompts: [],
  klingElements: [
    {
      id: "element-01",
      frontalImageUrl: "",
      referenceImageUrls: "",
      videoUrl: "",
    },
  ],
  klingVoiceIds: ["voice-1", ""] as [string, string],
  klingCfgScale: 0.5,
  klingNegativePrompt: "blur",
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
  addKlingShot: vi.fn(),
  removeKlingShot: vi.fn(),
  updateKlingMultiPrompt: vi.fn(),
  addKlingElement: vi.fn(),
  removeKlingElement: vi.fn(),
  updateKlingElement: vi.fn(),
};

describe("ReferenceKlingAdvancedSteps", () => {
  it("hides unsupported KIE-specific voice and negative prompt controls", () => {
    render(
      <ReferenceKlingAdvancedSteps
        {...baseProps}
        isKieKlingModel
        klingAssetsSummary="1 element · Prompt tokens ready"
      />
    );

    expect(screen.getByText("Assets")).toBeTruthy();
    expect(screen.queryByText("Assets & Voices")).toBeNull();
    expect(screen.queryByText("Voice IDs (optional)")).toBeNull();
    expect(screen.queryByText("Negative prompt")).toBeNull();
    expect(
      screen.getByText(/Use `@Element01`-style tokens in the prompt to bind KIE element/i)
    ).toBeTruthy();
    expect(
      screen.getByText(
        /KIE Kling guidance here is CFG-based\. Quality mode, sound, and multi-shot setup/i
      )
    ).toBeTruthy();
  });

  it("renders voice and negative prompt controls for non-KIE Kling models", () => {
    render(<ReferenceKlingAdvancedSteps {...baseProps} />);

    expect(screen.getByText("Assets & Voices")).toBeTruthy();
    expect(screen.getByText("Voice IDs (optional)")).toBeTruthy();
    expect(screen.getByText("Negative prompt")).toBeTruthy();
    expect(screen.queryByText(/Use `@Element01`-style tokens/i)).toBeNull();
  });
});
