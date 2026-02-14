import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaFiltersPanel } from "../MediaFiltersPanel";

describe("MediaFiltersPanel", () => {
  it("renders tab controls/count and wires tab + search changes", () => {
    const onSelectTab = vi.fn();
    const onSearchChange = vi.fn();

    render(
      <MediaFiltersPanel
        activeTab="uploaded_images"
        countLabel="files"
        search=""
        visibleCount={12}
        onSearchChange={onSearchChange}
        onSelectTab={onSelectTab}
      />
    );

    expect(screen.getByText("12 files")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Uploaded Videos" }));
    expect(onSelectTab).toHaveBeenCalledWith("uploaded_videos");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hero" } });
    expect(onSearchChange).toHaveBeenCalledWith("hero");
  });

  it("uses prompt-specific placeholder on saved prompts tab", () => {
    render(
      <MediaFiltersPanel
        activeTab="saved_prompts"
        countLabel="prompts"
        search=""
        visibleCount={1}
        onSearchChange={vi.fn()}
        onSelectTab={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText("Search saved prompts")).toBeInTheDocument();
  });
});
