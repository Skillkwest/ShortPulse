import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaLibraryHeader } from "../MediaLibraryHeader";

describe("MediaLibraryHeader", () => {
  it("renders title, description, storage value, and plan status", () => {
    render(
      <MediaLibraryHeader
        planLabel="Current plan"
        planName="Free"
        storageUsageValue="123.4 MB / 1.0 GB"
        storageCapacityValue="1.0 GB"
      />
    );

    expect(screen.getByRole("heading", { name: "Media Library" })).toBeInTheDocument();
    expect(
      screen.getByText("Upload, organize, and manage your workspace media in one place.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Media storage")).toBeInTheDocument();
    expect(screen.getByText("123.4 MB / 1.0 GB")).toBeInTheDocument();
    expect(screen.getByText("Capacity 1.0 GB")).toBeInTheDocument();
    expect(screen.getByLabelText("Plan status")).toBeInTheDocument();
    expect(screen.getByText("Current plan")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
  });
});
