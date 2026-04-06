import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceSeedanceAdvancedSteps } from "../ReferenceSeedanceAdvancedSteps";

describe("ReferenceSeedanceAdvancedSteps", () => {
  it("renders the Seedance 1.5 fixed-lens control", () => {
    const onVideoCameraFixedChange = vi.fn();

    render(
      <ReferenceSeedanceAdvancedSteps
        title="Seedance 1.5 Settings"
        isSeedance15Model
        isSeedance2FamilyModel={false}
        displayInputMode="text"
        videoCameraFixed={false}
        onVideoCameraFixedChange={onVideoCameraFixedChange}
        seedance2InputMode="text"
        seedance2ReferenceImageUrls={[]}
        seedance2ReferenceVideoUrls={[]}
        seedance2ReferenceAudioUrls={[]}
        seedance2ReturnLastFrame={false}
        seedance2WebSearch={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Lock camera" }));

    expect(onVideoCameraFixedChange).toHaveBeenCalledWith(true);
  });

  it("renders the Seedance 2 multimodal controls and reference textareas", () => {
    const onSeedance2InputModeChange = vi.fn();
    const onSeedance2ReferenceImageUrlsChange = vi.fn();
    const onSeedance2ReturnLastFrameChange = vi.fn();
    const onSeedance2WebSearchChange = vi.fn();

    render(
      <ReferenceSeedanceAdvancedSteps
        title="Seedance 2.0 Settings"
        isSeedance15Model={false}
        isSeedance2FamilyModel
        displayInputMode="multimodal"
        videoCameraFixed={false}
        seedance2InputMode="multimodal"
        seedance2ReferenceImageUrls={["https://example.com/ref-a.png"]}
        seedance2ReferenceVideoUrls={["https://example.com/ref-a.mp4"]}
        seedance2ReferenceAudioUrls={["https://example.com/ref-a.mp3"]}
        seedance2ReturnLastFrame={false}
        seedance2WebSearch={false}
        onSeedance2InputModeChange={onSeedance2InputModeChange}
        onSeedance2ReferenceImageUrlsChange={onSeedance2ReferenceImageUrlsChange}
        onSeedance2ReturnLastFrameChange={onSeedance2ReturnLastFrameChange}
        onSeedance2WebSearchChange={onSeedance2WebSearchChange}
      />
    );

    expect(screen.getByText("Multimodal references")).toBeInTheDocument();
    expect(screen.getByLabelText("Reference image URLs")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Reference image URLs"), {
      target: { value: "https://example.com/ref-b.png\nhttps://example.com/ref-c.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enable return last frame" }));
    fireEvent.click(screen.getByRole("button", { name: "Enable web search" }));

    expect(onSeedance2ReferenceImageUrlsChange).toHaveBeenCalledWith([
      "https://example.com/ref-b.png",
      "https://example.com/ref-c.png",
    ]);
    expect(onSeedance2ReturnLastFrameChange).toHaveBeenCalledWith(true);
    expect(onSeedance2WebSearchChange).toHaveBeenCalledWith(true);
  });
});
