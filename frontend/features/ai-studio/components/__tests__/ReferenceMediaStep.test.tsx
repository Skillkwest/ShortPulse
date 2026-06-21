import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceMediaStep } from "../ReferenceMediaStep";
import { loadVideoPreviewMetadata } from "../../logic/videoPreviewMetadata";
import {
  createCanvasTearOutComposerTargetRegistry,
  type CanvasTearOutPoint,
} from "../../hooks/useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";

vi.mock("../../logic/videoPreviewMetadata", () => ({
  loadVideoPreviewMetadata: vi.fn(async () => ({
    durationMs: 4123,
    posterUrl: "data:image/jpeg;base64,motion-poster",
  })),
}));

const canvasImagePayload: AgentComposerDirectDropPayload = {
  kind: "image",
  internalPayload: null,
  composerImagePayload: {
    version: 1,
    origin: "ai-studio-reference-grid",
    referenceId: "canvas-image",
    outputId: null,
    mediaId: "media-1",
    displayArtifactUrl: "https://example.com/canvas.png",
    displayArtifactKind: "url",
    sourceSurface: "all-refs",
  },
};

const canvasVideoPayload: AgentComposerDirectDropPayload = {
  kind: "video",
  videoUrl: "https://example.com/canvas-motion.mp4",
  internalPayload: null,
  outputId: "canvas-video",
  mediaId: "media-video-1",
  durationMs: 5400,
};

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

describe("ReferenceMediaStep motion intake", () => {
  it("opens Motion Control file pickers from keyboard-activated dropzones", () => {
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(
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

    fireEvent.keyDown(screen.getByRole("button", { name: "Upload character image" }), {
      key: "Enter",
    });
    fireEvent.keyDown(screen.getByRole("button", { name: "Upload motion clip" }), { key: " " });

    expect(inputClick).toHaveBeenCalledTimes(2);
    inputClick.mockRestore();
  });

  it("does not nest a keyboard upload button around filled Motion Control clear buttons", () => {
    render(
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
        referenceImageUrl="https://example.com/character.png"
        extraImageUrls={[null, null, null]}
        motionVideoUrl="https://example.com/motion.mp4"
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

    expect(screen.queryByRole("button", { name: "Upload character image" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Upload motion clip" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "×" })).toHaveLength(2);
  });

  it("opens Standard video frame file pickers from keyboard-activated dropzones", () => {
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(
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

    fireEvent.keyDown(screen.getByRole("button", { name: "Upload first frame" }), {
      key: "Enter",
    });
    fireEvent.keyDown(screen.getByRole("button", { name: "Upload last frame" }), { key: " " });

    expect(inputClick).toHaveBeenCalledTimes(2);
    inputClick.mockRestore();
  });

  it("opens Kling start and end frame file pickers from keyboard-activated dropzones", () => {
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(
      <ReferenceMediaStep
        referenceOrder={1}
        collapsedReference={false}
        onExpandReference={vi.fn()}
        onToggleReference={vi.fn()}
        isVideoVariant={true}
        referenceStepTitle="Add references"
        referenceStepSubtitle="Add references"
        isMotionMode={false}
        isKling3Mode={true}
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

    fireEvent.keyDown(screen.getByRole("button", { name: "Upload start frame" }), {
      key: "Enter",
    });
    fireEvent.keyDown(screen.getByRole("button", { name: "Upload end frame" }), { key: " " });

    expect(inputClick).toHaveBeenCalledTimes(2);
    inputClick.mockRestore();
  });

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

  it("registers Video frame slots as Canvas tear-out image targets", async () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    const acceptPrimaryCanvasTearOutPayload = vi.fn();
    const acceptExtraCanvasTearOutPayload = vi.fn();
    const primaryPoint: CanvasTearOutPoint = { clientX: 25, clientY: 25 };
    const lastFramePoint: CanvasTearOutPoint = { clientX: 155, clientY: 25 };

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
        canvasTearOutTargetRegistry={registry}
        acceptPrimaryCanvasTearOutPayload={acceptPrimaryCanvasTearOutPayload}
        acceptExtraCanvasTearOutPayload={acceptExtraCanvasTearOutPayload}
      />
    );

    const dropzones = container.querySelectorAll(".reference-dropzone");
    expect(dropzones).toHaveLength(2);
    setElementRect(dropzones[0], { left: 10, top: 10, width: 100, height: 100 });
    setElementRect(dropzones[1], { left: 140, top: 10, width: 100, height: 100 });

    await waitFor(() =>
      expect(registry.resolveTargetAtPoint(primaryPoint, canvasImagePayload)?.id).toBe(
        "video-primary-reference-frame"
      )
    );
    expect(registry.resolveTargetAtPoint(lastFramePoint, canvasImagePayload)?.id).toBe(
      "video-extra-reference-frame-0"
    );

    registry
      .resolveTargetAtPoint(primaryPoint, canvasImagePayload)
      ?.target.accept(canvasImagePayload);
    registry
      .resolveTargetAtPoint(lastFramePoint, canvasImagePayload)
      ?.target.accept(canvasImagePayload);

    expect(acceptPrimaryCanvasTearOutPayload).toHaveBeenCalledWith(canvasImagePayload);
    expect(acceptExtraCanvasTearOutPayload).toHaveBeenCalledWith(0, canvasImagePayload);

    act(() => {
      registry.setActiveTarget("video-primary-reference-frame");
    });
    expect(dropzones[0]).toHaveClass("is-dragging");
    act(() => {
      registry.setActiveTarget("video-extra-reference-frame-0");
    });
    expect(dropzones[1]).toHaveClass("is-dragging");
    act(() => {
      registry.clearActiveTarget();
    });
    expect(dropzones[1]).not.toHaveClass("is-dragging");
  });

  it("registers the Motion Control clip slot as a Canvas tear-out video target", async () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    const acceptMotionVideoCanvasTearOutPayload = vi.fn();
    const motionPoint: CanvasTearOutPoint = { clientX: 155, clientY: 25 };

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
        canvasTearOutTargetRegistry={registry}
        acceptMotionVideoCanvasTearOutPayload={acceptMotionVideoCanvasTearOutPayload}
      />
    );

    const motionDropzone = container.querySelector(".reference-dropzone.video-dropzone");
    expect(motionDropzone).not.toBeNull();
    setElementRect(motionDropzone as Element, { left: 140, top: 10, width: 100, height: 100 });

    await waitFor(() =>
      expect(registry.resolveTargetAtPoint(motionPoint, canvasVideoPayload)?.id).toBe(
        "video-motion-control-video"
      )
    );
    expect(registry.resolveTargetAtPoint(motionPoint, canvasImagePayload)).toBeNull();

    registry
      .resolveTargetAtPoint(motionPoint, canvasVideoPayload)
      ?.target.accept(canvasVideoPayload);
    expect(acceptMotionVideoCanvasTearOutPayload).toHaveBeenCalledWith(canvasVideoPayload);

    act(() => {
      registry.setActiveTarget("video-motion-control-video");
    });
    expect(motionDropzone).toHaveClass("is-dragging");
    act(() => {
      registry.clearActiveTarget();
    });
    expect(motionDropzone).not.toHaveClass("is-dragging");
  });
});
