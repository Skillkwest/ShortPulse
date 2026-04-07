/**
 * AI Studio Elements panel layout tests.
 * Verifies the cloned Character-style Elements shell and manage-mode scroll locking.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ElementsPanel } from "../ElementsPanel";

describe("ElementsPanel layout", () => {
  it("defaults embedded elements workflow to Manage Elements and keeps layout stable", () => {
    const { container } = render(<ElementsPanel />);

    expect(
      screen.queryByRole("tablist", { name: "Elements workflow mode" })
    ).not.toBeInTheDocument();

    const regions = Array.from(container.querySelectorAll("[data-layout-region]"))
      .map((node) => node.getAttribute("data-layout-region"))
      .filter((value): value is string => Boolean(value));
    expect(regions).toEqual([]);
    expect(screen.getByRole("heading", { name: "Elements" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Element Deck" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Element Sheet" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create New Element" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open element profile: Red Lantern" })
    ).toBeInTheDocument();
  });

  it("opens the profile editor when selecting a library card", () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Open element profile: Red Lantern" }));

    const workflowTablist = screen.getByRole("tablist", { name: "Elements workflow mode" });
    const workflowTabs = within(workflowTablist).getAllByRole("tab");
    expect(workflowTabs[0]).toHaveTextContent("Manage Elements");
    expect(workflowTabs[1]).toHaveTextContent("Element Profile");
    expect(screen.getByRole("tab", { name: "Element Profile" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("heading", { name: "Element Deck" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Element Sheet" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Red Lantern")).toBeInTheDocument();
    expect(screen.getByDisplayValue("redlantern")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Double click me" })).toBeInTheDocument();
  });

  it("creates a blank local element and opens the cloned profile shell", () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Create New Element" }));

    expect(screen.getByRole("heading", { name: "Element Deck" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Element Sheet" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name:" })).toHaveValue("");
    expect(screen.getByRole("tab", { name: "Manage Elements" })).toBeInTheDocument();
  });

  it("returns to Manage Elements after confirming delete", () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Open element profile: Red Lantern" }));
    fireEvent.click(screen.getByRole("tab", { name: "Manage Elements" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete element: Red Lantern" }));

    expect(screen.getByText("Delete this element?")).toBeInTheDocument();

    fireEvent.click(
      within(
        screen.getByText("Delete this element?").closest(".modal-card") as HTMLElement
      ).getByRole("button", { name: "Delete" })
    );

    expect(screen.getByRole("heading", { name: "Elements" })).toBeInTheDocument();
    expect(screen.queryByText("Red Lantern")).not.toBeInTheDocument();
  });

  it("locks the properties rail scroll in Manage Elements mode", () => {
    const { container } = render(
      <div className="ai-properties" style={{ overflowY: "auto", overscrollBehaviorY: "auto" }}>
        <ElementsPanel />
      </div>
    );
    const propertiesRail = container.querySelector(".ai-properties") as HTMLDivElement | null;
    if (!propertiesRail) {
      throw new Error("Expected ai-properties wrapper to exist.");
    }

    expect(propertiesRail.style.overflowY).toBe("hidden");
    expect(propertiesRail.style.overscrollBehaviorY).toBe("none");
  });
});
