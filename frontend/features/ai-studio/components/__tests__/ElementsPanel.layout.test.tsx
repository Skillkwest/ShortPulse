import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ElementsPanel } from "../ElementsPanel";

describe("ElementsPanel layout", () => {
  it("defaults embedded elements workflow to Manage Elements and shows library cards", () => {
    render(<ElementsPanel />);

    const workflowTablist = screen.getByRole("tablist", { name: "Elements workflow mode" });
    const workflowTabs = within(workflowTablist).getAllByRole("tab");

    expect(workflowTabs[0]).toHaveTextContent("Manage Elements");
    expect(workflowTabs[1]).toHaveTextContent("Element Profile");
    expect(screen.getByRole("tab", { name: "Manage Elements" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("Elements")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Elements Library" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create New Element" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open element profile: Red Lantern" })
    ).toBeInTheDocument();
  });

  it("opens the profile editor when selecting a library card", () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Open element profile: Red Lantern" }));

    expect(screen.getByRole("tab", { name: "Element Profile" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("heading", { name: "Element Profile" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Red Lantern")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Element Sheet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Element Deck" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Element" })).toBeInTheDocument();
  });

  it("opens create mode from the library header CTA", () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Create New Element" }));

    expect(screen.getByRole("heading", { name: "Create Element" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Element" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Element" })).not.toBeInTheDocument();
  });

  it("returns to Manage Elements after confirming delete", () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Open element profile: Red Lantern" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Element" }));

    expect(
      screen.getByRole("alertdialog", { name: "Delete element confirmation" })
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" })
    );

    expect(screen.getByRole("heading", { name: "Elements Library" })).toBeInTheDocument();
    expect(
      screen.queryByRole("alertdialog", { name: "Delete element confirmation" })
    ).not.toBeInTheDocument();
  });
});
