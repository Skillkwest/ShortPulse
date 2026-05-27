import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceMediaStep } from "../ReferenceMediaStep";

describe("ReferenceMediaStep motion recorder affordance", () => {
  it("renders a record action for the Motion tile and keeps WEBM in the picker contract", () => {
    const onOpenMotionRecorder = vi.fn();

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
        onOpenMotionRecorder={onOpenMotionRecorder}
        handleFileSelection={() => vi.fn()}
        handleMotionVideoSelection={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Record clip" }));
    expect(onOpenMotionRecorder).toHaveBeenCalledTimes(1);

    const motionVideoInput = container.querySelector('input[type="file"][accept*=".webm"]');
    expect(motionVideoInput).not.toBeNull();
    expect(motionVideoInput?.getAttribute("accept")).toContain("video/webm");
  });
});
