import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaUploadStage } from "../MediaUploadStage";

describe("MediaUploadStage", () => {
  it("wires drag/drop + picker handlers and renders upload/selection details", () => {
    const onDragOver = vi.fn();
    const onDragLeave = vi.fn();
    const onDrop = vi.fn();
    const onFileChange = vi.fn();
    const onTriggerFilePicker = vi.fn();

    render(
      <MediaUploadStage
        activeTab="uploaded_images"
        error="Upload failed"
        fileInputRef={createRef<HTMLInputElement | null>()}
        isDragging
        planLimitMb={1024}
        selectedFiles={[
          new File(["1"], "first.png", { type: "image/png" }),
          new File(["2"], "second.png", { type: "image/png" }),
          new File(["3"], "third.png", { type: "image/png" }),
          new File(["4"], "fourth.png", { type: "image/png" }),
        ]}
        totalBytes={500 * 1024 * 1024}
        uploadCount={2}
        uploading
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onFileChange={onFileChange}
        onTriggerFilePicker={onTriggerFilePicker}
      />
    );

    const dropRegion = screen.getByRole("region", { name: "File upload area" });
    fireEvent.dragOver(dropRegion);
    fireEvent.dragLeave(dropRegion);
    fireEvent.drop(dropRegion);

    expect(onDragOver).toHaveBeenCalledTimes(1);
    expect(onDragLeave).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Add Files" }));
    expect(onTriggerFilePicker).toHaveBeenCalledTimes(1);

    const fileInput = screen.getByLabelText("Select media files");
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(onFileChange).toHaveBeenCalledTimes(1);
    expect(fileInput).toHaveAttribute("accept", "image/*,video/*");

    expect(screen.getByText("Uploading 2 files…")).toBeInTheDocument();
    expect(screen.getByText("Upload failed")).toBeInTheDocument();
    expect(screen.getByText(/4 selected/i)).toBeInTheDocument();
    expect(screen.getByText(/first\.png, second\.png, third\.png…/i)).toBeInTheDocument();
    expect(screen.getByText("500.0 MB")).toBeInTheDocument();
    expect(screen.getByText("of 1.0 GB")).toBeInTheDocument();
  });

  it("uses private-tab picker accept list", () => {
    render(
      <MediaUploadStage
        activeTab="private"
        error={null}
        fileInputRef={createRef<HTMLInputElement | null>()}
        isDragging={false}
        planLimitMb={1024}
        selectedFiles={[]}
        totalBytes={0}
        uploadCount={0}
        uploading={false}
        onDragLeave={vi.fn()}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onFileChange={vi.fn()}
        onTriggerFilePicker={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Select media files")).toHaveAttribute("accept", "image/*");
  });
});
