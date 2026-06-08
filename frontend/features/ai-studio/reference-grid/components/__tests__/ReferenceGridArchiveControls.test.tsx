import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceGridArchiveControls } from "../ReferenceGridArchiveControls";

describe("ReferenceGridArchiveControls", () => {
  it("shows the visible media count in the header row when the title is hidden", () => {
    render(
      <ReferenceGridArchiveControls
        archiveCount={0}
        visibleItemCount={7}
        showHeader
        showTitle={false}
        isArchivePanelOpen={false}
        archivedOutputs={[]}
        onToggleArchivePanel={vi.fn()}
        onTriggerFileSelect={vi.fn()}
        onOpenMediaLibrary={vi.fn()}
      />
    );

    expect(screen.getByText("Media: 7/250")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add files" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Media Library" })).toBeInTheDocument();
  });
});
