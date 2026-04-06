import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceVideoSettingsStep } from "../ReferenceVideoSettingsStep";

const baseProps = {
  isVideoVariant: true,
  isMotionMode: false,
  modelId: "fal-ai/veo3.1",
  modelLabel: "Veo 3.1",
  isModelModalOpen: false,
  modelModalAnchor: null,
  aspect: "16:9",
  aspectOptionsForModel: [
    {
      value: "16:9",
      ratioLabel: "16:9",
      name: "Landscape",
      orientation: "horizontal" as const,
    },
  ],
  videoSettingsOrder: 4,
  motionAudioOrder: 3,
  videoDurationValue: 8,
  videoResolutionValue: "1080p",
  durationOptions: [5, 8, 10],
  resolutionOptions: [{ value: "1080p", label: "1080p (Full HD)" }],
  videoGenerateAudioValue: true,
  isSeedanceI2VModel: false,
  videoCameraFixed: false,
  isVeoModel: false,
  videoAutoFix: false,
  onAspectChange: vi.fn(),
  onModelPickerOpen: vi.fn(),
  onVideoDurationChange: vi.fn(),
  onVideoResolutionChange: vi.fn(),
  onVideoGenerateAudioChange: vi.fn(),
  onVideoCameraFixedChange: vi.fn(),
  onVideoAutoFixChange: vi.fn(),
};

describe("ReferenceVideoSettingsStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides resolution control when no options are available", () => {
    render(<ReferenceVideoSettingsStep {...baseProps} resolutionOptions={[]} />);

    expect(screen.queryByRole("option", { name: "1080p (Full HD)" })).toBeNull();
  });

  it("renders resolution control when options are available", () => {
    render(<ReferenceVideoSettingsStep {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Video resolution" }));

    expect(screen.getByRole("option", { name: "1080p (Full HD)" })).toBeTruthy();
  });

  it("keeps the model picker wired to the existing open handler", () => {
    render(<ReferenceVideoSettingsStep {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /veo 3.1/i }));

    expect(baseProps.onModelPickerOpen).toHaveBeenCalledTimes(1);
    expect(baseProps.onModelPickerOpen.mock.calls[0][0]).toBe("video-settings-model");
    expect(baseProps.onModelPickerOpen.mock.calls[0][2]).toBe("reference-video");
  });

  it("keeps the audio toggle wired to the existing change handler", () => {
    render(<ReferenceVideoSettingsStep {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Disable audio generation" }));

    expect(baseProps.onVideoGenerateAudioChange).toHaveBeenCalledWith(false);
  });
});
