import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaGalleryActions } from "../MediaGalleryActions";

describe("MediaGalleryActions", () => {
  it("renders media-tab controls and wires selection/move/delete actions", () => {
    const onClearSelection = vi.fn();
    const onSelectAllVisible = vi.fn();
    const onToggleBulkMoveMenu = vi.fn();
    const onMoveSelected = vi.fn();
    const onRequestDeleteSelected = vi.fn();

    render(
      <MediaGalleryActions
        activeTab="uploaded_images"
        allVisibleSelected={false}
        bulkDeleting={false}
        bulkMoveError={null}
        bulkMoveMenuOpen
        bulkMoveNotice={null}
        bulkMoveTabOptions={[{ tab: "private", label: "Private", disabled: false }]}
        bulkMoving={false}
        canBulkMove
        deleteButtonLabel="Delete selected"
        deleteItemLabel="files"
        isPromptTab={false}
        onClearSelection={onClearSelection}
        onMoveSelected={onMoveSelected}
        onRequestDeleteSelected={onRequestDeleteSelected}
        onSelectAllVisible={onSelectAllVisible}
        onToggleBulkMoveMenu={onToggleBulkMoveMenu}
        selectedIdsCount={2}
        selectedMediaRowsCount={2}
        selectableIdsCount={4}
      />
    );

    expect(screen.getByText("Uploaded images")).toBeInTheDocument();
    expect(screen.getByText("Your uploaded images")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(onSelectAllVisible).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("menuitem", { name: "Private" }));
    expect(onMoveSelected).toHaveBeenCalledWith("private");

    fireEvent.click(screen.getByRole("button", { name: /Delete selected/i }));
    expect(onRequestDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it("hides move controls for prompt tab and renders prompt heading", () => {
    render(
      <MediaGalleryActions
        activeTab="saved_prompts"
        allVisibleSelected={false}
        bulkDeleting={false}
        bulkMoveError={null}
        bulkMoveMenuOpen={false}
        bulkMoveNotice={null}
        bulkMoveTabOptions={[]}
        bulkMoving={false}
        canBulkMove={false}
        deleteButtonLabel="Delete selected"
        deleteItemLabel="prompts"
        isPromptTab
        onClearSelection={vi.fn()}
        onMoveSelected={vi.fn()}
        onRequestDeleteSelected={vi.fn()}
        onSelectAllVisible={vi.fn()}
        onToggleBulkMoveMenu={vi.fn()}
        selectedIdsCount={0}
        selectedMediaRowsCount={0}
        selectableIdsCount={0}
      />
    );

    expect(screen.getByText("Saved prompts")).toBeInTheDocument();
    expect(screen.queryByText("Move selected")).toBeNull();
  });
});
