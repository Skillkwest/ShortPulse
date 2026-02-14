import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaFiltersRow } from "../MediaFiltersRow";

describe("MediaFiltersRow", () => {
  it("renders workspace navigation shell and wires filter interactions", () => {
    const onSelectTab = vi.fn();
    const onSearchChange = vi.fn();

    render(
      <MediaFiltersRow
        activeTab="uploaded_images"
        countLabel="files"
        search=""
        visibleCount={8}
        onSearchChange={onSearchChange}
        onSelectTab={onSelectTab}
      />
    );

    expect(screen.getByLabelText("Workspace navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Uploaded Videos" }));
    expect(onSelectTab).toHaveBeenCalledWith("uploaded_videos");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "product" } });
    expect(onSearchChange).toHaveBeenCalledWith("product");
  });
});
