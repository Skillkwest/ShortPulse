import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaLibraryHeader } from "../MediaLibraryHeader";

describe("MediaLibraryHeader", () => {
  it("renders title, description, storage value, and plan status", () => {
    render(
      <MediaLibraryHeader
        planLabel="Plan"
        planName="Creative Suite"
        storageUsageValue="123.4 MB / 1.0 GB"
      />
    );

    expect(screen.getByRole("heading", { name: "Media Library" })).toBeInTheDocument();
    expect(
      screen.getByText("Upload, organize, and manage your workspace media in one place.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Media storage")).toBeInTheDocument();
    expect(screen.getByText("123.4 MB / 1.0 GB")).toBeInTheDocument();
    expect(screen.getByLabelText("Plan status")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Creative Suite")).toBeInTheDocument();
  });
});
