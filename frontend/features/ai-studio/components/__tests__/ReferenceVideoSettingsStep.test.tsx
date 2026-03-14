import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceVideoSettingsStep } from "../ReferenceVideoSettingsStep";

const baseProps = {
  isVideoVariant: true,
  isMotionMode: false,
  beginnerMode: false,
  videoSettingsOrder: 4,
  videoSettingsBadge: "4",
  motionAudioOrder: 3,
  motionAudioBadge: "3",
  collapsedVideoSettings: false,
  collapsedMotionAudio: true,
  videoDurationValue: 8,
  videoResolutionValue: "1080p",
  durationOptions: [5, 8, 10],
  resolutionOptions: [{ value: "1080p", label: "1080p (Full HD)" }],
  videoGenerateAudioValue: true,
  isVeoImageToVideoStandard: false,
  isVeoFirstLastModel: false,
  isSeedanceI2VModel: false,
  videoCameraFixed: false,
  isKling3Model: false,
  klingShotType: "customize" as const,
  isVeoModel: false,
  videoAutoFix: false,
  onExpandVideoSettings: vi.fn(),
  onToggleVideoSettings: vi.fn(),
  onExpandMotionAudio: vi.fn(),
  onToggleMotionAudio: vi.fn(),
  onVideoDurationChange: vi.fn(),
  onVideoResolutionChange: vi.fn(),
  onVideoGenerateAudioChange: vi.fn(),
  onVideoCameraFixedChange: vi.fn(),
  onKlingShotTypeChange: vi.fn(),
  onVideoAutoFixChange: vi.fn(),
};

describe("ReferenceVideoSettingsStep", () => {
  it("hides resolution control when no options are available", () => {
    render(<ReferenceVideoSettingsStep {...baseProps} resolutionOptions={[]} />);

    expect(screen.queryByText("Resolution")).toBeNull();
  });

  it("renders resolution control when options are available", () => {
    render(<ReferenceVideoSettingsStep {...baseProps} />);

    expect(screen.getByText("Resolution")).toBeTruthy();
  });
});
