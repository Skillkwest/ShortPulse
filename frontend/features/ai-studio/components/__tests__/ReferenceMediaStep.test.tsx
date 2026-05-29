import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceMediaStep } from "../ReferenceMediaStep";
import { loadVideoPreviewMetadata } from "../../logic/videoPreviewMetadata";

vi.mock("../../logic/videoPreviewMetadata", () => ({
  loadVideoPreviewMetadata: vi.fn(async () => ({
    durationMs: 4123,
    posterUrl: "data:image/jpeg;base64,motion-poster",
  })),
}));

describe("ReferenceMediaStep motion intake", () => {
  it("keeps the Motion tile focused on upload/drop intake and accepts WEBM clips", () => {
    const { container } = render(
      <ReferenceMediaStep
        referenceOrder={1}
        collapsedReference={false}
        onExpandReference={vi.fn()}
        onToggleReference={vi.fn()}
        isVideoVariant={true}
        referenceStepTitle="Add Motion Inputs"
        referenceStepSubtitle="Add references"
        isMotionMode={true}
        isKling3Mode={false}
        isStandardMode={false}
        isKeyframesMode={false}
        referenceImageUrl={null}
        extraImageUrls={[null, null, null]}
        motionVideoUrl={null}
        primaryDragActive={false}
        extraDragActive={[false, false, false]}
        motionVideoDragActive={false}
        setMotionVideoDragActive={vi.fn()}
        handlePrimaryDrop={vi.fn()}
        handlePrimaryDragEnter={vi.fn()}
        handlePrimaryDragOver={vi.fn()}
        handlePrimaryDragLeave={vi.fn()}
        handleExtraDrop={() => vi.fn()}
        handleExtraDragEnter={() => vi.fn()}
        handleExtraDragOver={() => vi.fn()}
        handleExtraDragLeave={() => vi.fn()}
        allowVideoDrag={vi.fn(() => false)}
        handleMotionVideoDrop={vi.fn()}
        primaryInputRef={{ current: null }}
        extraOneInputRef={{ current: null }}
        extraTwoInputRef={{ current: null }}
        extraThreeInputRef={{ current: null }}
        motionVideoInputRef={{ current: null }}
        onPrimaryImageChange={vi.fn()}
        onExtraImageChange={vi.fn()}
        onMotionVideoChange={vi.fn()}
        handleFileSelection={() => vi.fn()}
        handleMotionVideoSelection={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Record clip" })).toBeNull();

    const motionVideoInput = container.querySelector('input[type="file"][accept*=".webm"]');
    expect(motionVideoInput).not.toBeNull();
    expect(motionVideoInput?.getAttribute("accept")).toContain("video/webm");
  });

  it("renders a poster thumbnail and shared duration badge for an uploaded motion clip", async () => {
    const { container } = render(
      <ReferenceMediaStep
        referenceOrder={1}
        collapsedReference={false}
        onExpandReference={vi.fn()}
        onToggleReference={vi.fn()}
        isVideoVariant={true}
        referenceStepTitle="Add Motion Inputs"
        referenceStepSubtitle="Add references"
        isMotionMode={true}
        isKling3Mode={false}
        isStandardMode={false}
        isKeyframesMode={false}
        referenceImageUrl={null}
        extraImageUrls={[null, null, null]}
        motionVideoUrl="https://example.com/motion-reference.mp4"
        primaryDragActive={false}
        extraDragActive={[false, false, false]}
        motionVideoDragActive={false}
        setMotionVideoDragActive={vi.fn()}
        handlePrimaryDrop={vi.fn()}
        handlePrimaryDragEnter={vi.fn()}
        handlePrimaryDragOver={vi.fn()}
        handlePrimaryDragLeave={vi.fn()}
        handleExtraDrop={() => vi.fn()}
        handleExtraDragEnter={() => vi.fn()}
        handleExtraDragOver={() => vi.fn()}
        handleExtraDragLeave={() => vi.fn()}
        allowVideoDrag={vi.fn(() => false)}
        handleMotionVideoDrop={vi.fn()}
        primaryInputRef={{ current: null }}
        extraOneInputRef={{ current: null }}
        extraTwoInputRef={{ current: null }}
        extraThreeInputRef={{ current: null }}
        motionVideoInputRef={{ current: null }}
        onPrimaryImageChange={vi.fn()}
        onExtraImageChange={vi.fn()}
        onMotionVideoChange={vi.fn()}
        handleFileSelection={() => vi.fn()}
        handleMotionVideoSelection={vi.fn()}
      />
    );

    expect(await screen.findByText("0:04")).toBeInTheDocument();
    expect(loadVideoPreviewMetadata).toHaveBeenCalledWith(
      "https://example.com/motion-reference.mp4",
      {
        posterCaptureTimeSeconds: 3,
      }
    );
    expect(container.querySelector(".reference-dropzone-poster")).not.toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  it("shows a loading spinner overlay for Video panel frame slots while a drop is resolving", () => {
    const { container } = render(
      <ReferenceMediaStep
        referenceOrder={1}
        collapsedReference={false}
        onExpandReference={vi.fn()}
        onToggleReference={vi.fn()}
        isVideoVariant={true}
        referenceStepTitle="Add references"
        referenceStepSubtitle="Add references"
        isMotionMode={false}
        isKling3Mode={false}
        isStandardMode={true}
        isKeyframesMode={false}
        referenceImageUrl={null}
        extraImageUrls={[null, null, null]}
        motionVideoUrl={null}
        primaryDragActive={false}
        extraDragActive={[false, false, false]}
        primaryImageLoading={true}
        extraImageLoading={[true, false, false]}
        motionVideoDragActive={false}
        setMotionVideoDragActive={vi.fn()}
        handlePrimaryDrop={vi.fn()}
        handlePrimaryDragEnter={vi.fn()}
        handlePrimaryDragOver={vi.fn()}
        handlePrimaryDragLeave={vi.fn()}
        handleExtraDrop={() => vi.fn()}
        handleExtraDragEnter={() => vi.fn()}
        handleExtraDragOver={() => vi.fn()}
        handleExtraDragLeave={() => vi.fn()}
        allowVideoDrag={vi.fn(() => false)}
        handleMotionVideoDrop={vi.fn()}
        primaryInputRef={{ current: null }}
        extraOneInputRef={{ current: null }}
        extraTwoInputRef={{ current: null }}
        extraThreeInputRef={{ current: null }}
        motionVideoInputRef={{ current: null }}
        onPrimaryImageChange={vi.fn()}
        onExtraImageChange={vi.fn()}
        onMotionVideoChange={vi.fn()}
        handleFileSelection={() => vi.fn()}
        handleMotionVideoSelection={vi.fn()}
      />
    );

    expect(container.querySelectorAll(".reference-dropzone-loading")).toHaveLength(2);
    expect(container.querySelectorAll(".reference-spinner")).toHaveLength(2);
  });
});
