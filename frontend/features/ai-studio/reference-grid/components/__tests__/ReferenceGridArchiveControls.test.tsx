import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferenceGridArchiveControls } from "../ReferenceGridArchiveControls";
import {
  REFERENCE_GRID_MAX_VISIBLE_ITEMS,
  REFERENCE_GRID_WARN_VISIBLE_ITEMS,
} from "../../logic/referenceGridLimits";

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
      />
    );

    expect(screen.getByText(`Media: 7/${REFERENCE_GRID_MAX_VISIBLE_ITEMS}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add files" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Media Library" })).toBeNull();
  });

  it("marks the visible media count when the active workset is near the cap", () => {
    render(
      <ReferenceGridArchiveControls
        archiveCount={0}
        visibleItemCount={REFERENCE_GRID_WARN_VISIBLE_ITEMS}
        showHeader
        isArchivePanelOpen={false}
        archivedOutputs={[]}
        onToggleArchivePanel={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        `Media: ${REFERENCE_GRID_WARN_VISIBLE_ITEMS}/${REFERENCE_GRID_MAX_VISIBLE_ITEMS}`
      )
    ).toHaveClass("is-near-active-workset-limit");
  });
});
