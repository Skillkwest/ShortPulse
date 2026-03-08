/**
 * StylesLibraryPanel tests.
 * Covers delete affordance visibility and confirm-modal delete behavior.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StylesLibraryPanel } from "../StylesLibraryPanel";
import type { ExpertEditStyleTile } from "../edit/expertEditStyles";

const createStyles = (): ExpertEditStyleTile[] => [
  {
    id: "cinematic",
    title: "Cinematic",
    previewUrl: "/Styles/Cinematic.png",
    placeholder: false,
  },
  {
    id: "anime",
    title: "Anime",
    previewUrl: "/Styles/Anime.png",
    placeholder: false,
  },
];

const createStylesWithPlaceholder = (): ExpertEditStyleTile[] => [
  ...createStyles(),
  {
    id: "style-placeholder-1",
    title: "Placeholder 1",
    previewUrl: null,
    placeholder: true,
  },
];

describe("StylesLibraryPanel", () => {
  it("renders delete action only for non-placeholder styles", () => {
    render(<StylesLibraryPanel styles={createStylesWithPlaceholder()} selectedStyleId={null} />);

    expect(screen.getByRole("button", { name: "Delete style: Cinematic" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete style: Placeholder 1" })
    ).not.toBeInTheDocument();
  });

  it("adds placeholder cards with the trailing plus button", () => {
    const { container } = render(
      <StylesLibraryPanel styles={createStyles()} selectedStyleId={null} />
    );

    const addButton = screen.getByRole("button", { name: "Add placeholder style" });
    expect(addButton).toBeInTheDocument();

    fireEvent.click(addButton);
    expect(
      screen.getByRole("button", { name: "Style tile: Placeholder 1 (coming soon)" })
    ).toBeDisabled();

    fireEvent.click(addButton);
    expect(
      screen.getByRole("button", { name: "Style tile: Placeholder 2 (coming soon)" })
    ).toBeDisabled();

    const listItems = container.querySelectorAll('.styles-library-grid > [role="listitem"]');
    expect(listItems.item(listItems.length - 1)).toContainElement(addButton);
  });

  it("reorders style cards via drag and drop", () => {
    render(<StylesLibraryPanel styles={createStyles()} selectedStyleId={null} />);

    const sourceTile = screen
      .getByRole("button", { name: "Style tile: Cinematic" })
      .closest("article");
    const targetTile = screen.getByRole("button", { name: "Style tile: Anime" }).closest("article");
    expect(sourceTile).toBeTruthy();
    expect(targetTile).toBeTruthy();

    const transfer = {
      setData: vi.fn(),
      getData: vi.fn(() => "cinematic"),
      effectAllowed: "move",
      dropEffect: "move",
    } as unknown as DataTransfer;

    fireEvent.dragStart(sourceTile as HTMLElement, { dataTransfer: transfer });
    fireEvent.dragOver(targetTile as HTMLElement, { dataTransfer: transfer });
    fireEvent.drop(targetTile as HTMLElement, { dataTransfer: transfer });
    fireEvent.dragEnd(sourceTile as HTMLElement, { dataTransfer: transfer });

    const titles = screen
      .getAllByRole("button", { name: /Style tile:/i })
      .map((button) => button.textContent?.trim());
    expect(titles[0]).toContain("Anime");
    expect(titles[1]).toContain("Cinematic");
  });

  it("opens and closes the delete confirmation modal", () => {
    render(<StylesLibraryPanel styles={createStyles()} selectedStyleId={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete style: Cinematic" }));
    expect(screen.getByRole("dialog", { name: "Delete style?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(screen.queryByRole("dialog", { name: "Delete style?" })).not.toBeInTheDocument();
  });

  it("confirms delete and calls onDeleteStyle with the selected style id", async () => {
    const onDeleteStyle = vi.fn().mockResolvedValue(true);
    render(
      <StylesLibraryPanel
        styles={createStyles()}
        selectedStyleId={null}
        onDeleteStyle={onDeleteStyle}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete style: Cinematic" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => {
      expect(onDeleteStyle).toHaveBeenCalledWith("cinematic");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete style?" })).not.toBeInTheDocument();
    });
  });

  it("opens edit modal when a style tile is clicked", () => {
    render(<StylesLibraryPanel styles={createStyles()} selectedStyleId={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Style tile: Cinematic" }));

    expect(screen.getByRole("dialog", { name: "Edit style" })).toBeInTheDocument();
    expect(screen.getByLabelText("Style")).toHaveValue("Cinematic");
    expect(screen.getByLabelText("Title")).toHaveValue("Cinematic");
    expect(screen.getByLabelText("Reference Image Name")).toHaveValue("Cinematic");
    expect(screen.getByLabelText("Style Prompt")).toHaveValue("");
  });

  it("saves style details from edit modal", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    render(
      <StylesLibraryPanel
        styles={createStyles()}
        selectedStyleId={null}
        onSaveStyleDetails={onSaveStyleDetails}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Style tile: Cinematic" }));
    fireEvent.change(screen.getByLabelText("Style"), { target: { value: "Neo Noir" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Neo Noir Title" } });
    fireEvent.change(screen.getByLabelText("Reference Image Name"), {
      target: { value: "Night Alley Ref" },
    });
    fireEvent.change(screen.getByLabelText("Style Prompt"), {
      target: { value: "high contrast, cinematic street lighting" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onSaveStyleDetails).toHaveBeenCalledWith("cinematic", {
        style: "Neo Noir",
        title: "Neo Noir Title",
        referenceImageName: "Night Alley Ref",
        stylePrompt: "high contrast, cinematic street lighting",
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit style" })).not.toBeInTheDocument();
    });
  });
});
