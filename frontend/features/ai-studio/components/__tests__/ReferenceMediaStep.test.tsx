/**
 * ReferenceMediaStep video reference pill visibility tests.
 * Verifies optional pills disappear once the corresponding image dropzone has a loaded preview.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceMediaStep } from "../ReferenceMediaStep";

const baseProps = {
  referenceOrder: 1,
  referenceBadge: "1",
  collapsedReference: false,
  onExpandReference: vi.fn(),
  onToggleReference: vi.fn(),
  beginnerMode: false,
  isVideoVariant: true,
  referenceStepTitle: "Add References",
  referenceStepSubtitle: "Add references",
  isMotionMode: false,
  isKling3Mode: false,
  isStandardMode: true,
  isKeyframesMode: false,
  referenceImageUrl: null,
  extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
  motionVideoUrl: null,
  primaryDragActive: false,
  extraDragActive: [false, false, false],
  motionVideoDragActive: false,
  setMotionVideoDragActive: vi.fn(),
  handlePrimaryDrop: vi.fn(),
  handlePrimaryDragEnter: vi.fn(),
  handlePrimaryDragOver: vi.fn(),
  handlePrimaryDragLeave: vi.fn(),
  handleExtraDrop: vi.fn(),
  handleExtraDragEnter: vi.fn(),
  handleExtraDragOver: vi.fn(),
  handleExtraDragLeave: vi.fn(),
  allowVideoDrag: vi.fn(() => false),
  handleMotionVideoDrop: vi.fn(),
  primaryInputRef: { current: null },
  extraOneInputRef: { current: null },
  extraTwoInputRef: { current: null },
  extraThreeInputRef: { current: null },
  motionVideoInputRef: { current: null },
  onPrimaryImageChange: vi.fn(),
  onExtraImageChange: vi.fn(),
  onMotionVideoChange: vi.fn(),
  handleFileSelection: vi.fn(),
  handleMotionVideoSelection: vi.fn(),
};

describe("ReferenceMediaStep", () => {
  it("hides the optional pills once the matching image preview is loaded", () => {
    const { rerender } = render(<ReferenceMediaStep {...baseProps} />);

    expect(screen.getAllByText("Optional")).toHaveLength(2);

    rerender(
      <ReferenceMediaStep
        {...baseProps}
        referenceImageUrl="https://example.com/first-frame.jpg"
        extraImageUrls={["https://example.com/last-frame.jpg", null, null]}
      />
    );

    expect(screen.queryByText("Optional")).toBeNull();
  });

  it("shows a required pill on the first frame when standard video explicitly requires an image", () => {
    render(<ReferenceMediaStep {...baseProps} primaryImageRequired />);

    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });
});
