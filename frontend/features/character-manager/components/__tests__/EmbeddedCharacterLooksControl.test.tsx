import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CharacterSheetPresetId } from "../../types";
import { EmbeddedCharacterLooksControl } from "../EmbeddedCharacterLooksControl";

const buildLabels = () =>
  ({
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
    "10": "10",
  }) satisfies Record<CharacterSheetPresetId, string>;

function Harness({
  initialPresetIds,
  initialActivePresetId,
}: {
  initialPresetIds: CharacterSheetPresetId[];
  initialActivePresetId?: CharacterSheetPresetId;
}) {
  const [presetIds, setPresetIds] = React.useState(initialPresetIds);
  const [activePresetId, setActivePresetId] = React.useState<CharacterSheetPresetId>(
    initialActivePresetId ?? initialPresetIds[0] ?? "1"
  );
  const [labels, setLabels] = React.useState(buildLabels);

  return (
    <EmbeddedCharacterLooksControl
      presetIds={presetIds}
      activePresetId={activePresetId}
      presetLabels={labels}
      onSelectPreset={(presetId) => {
        setActivePresetId(presetId);
      }}
      onAddPreset={() => {
        const nextPresetId = String(presetIds.length + 1) as CharacterSheetPresetId;
        setPresetIds((current) => [...current, nextPresetId]);
        setActivePresetId(nextPresetId);
      }}
      onRenamePreset={(presetId, nextLabel) => {
        setLabels((current) => ({
          ...current,
          [presetId]: nextLabel.trim() || presetId,
        }));
      }}
      onDeletePreset={(presetId) => {
        if (presetId === "1") return;
        const remainingPresetIds = presetIds.filter((id) => id !== presetId);
        setPresetIds(remainingPresetIds);
        setActivePresetId(remainingPresetIds[0] ?? "1");
      }}
      panelId="looks-panel"
      idBase="embedded-looks-test"
    />
  );
}

describe("EmbeddedCharacterLooksControl", () => {
  it("renders a fixed four-up rail for the default embedded case", () => {
    render(<Harness initialPresetIds={["1", "2", "3", "4"]} />);

    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add character look" })).toBeInTheDocument();
  });

  it("renders overflow looks directly in the rail without an options button", () => {
    render(<Harness initialPresetIds={["1", "2", "3", "4", "5"]} initialActivePresetId="5" />);

    expect(screen.getByRole("tab", { name: "5" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage looks" })).not.toBeInTheDocument();
  });

  it("supports direct tab selection", async () => {
    render(<Harness initialPresetIds={["1", "2", "3", "4"]} />);

    const tabThree = screen.getByRole("tab", { name: "3" });
    fireEvent.pointerDown(tabThree, { button: 0, pointerId: 1, clientX: 40, pointerType: "mouse" });
    fireEvent.pointerUp(tabThree, { button: 0, pointerId: 1, clientX: 40, pointerType: "mouse" });
    fireEvent.click(tabThree);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "3" })).toHaveAttribute("aria-selected", "true");
    });
  });

  it("keeps the add button available without extra options chrome", () => {
    render(<Harness initialPresetIds={["1", "2", "3", "4"]} />);

    expect(screen.getByRole("button", { name: "Add character look" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage looks" })).not.toBeInTheDocument();
  });

  it("creates a new look when the add button is clicked", async () => {
    render(<Harness initialPresetIds={["1", "2", "3", "4"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Add character look" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "5" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "5" })).toHaveAttribute("aria-selected", "true");
    });
  });

  it("shows the delete affordance on hover for deletable tabs", async () => {
    render(<Harness initialPresetIds={["1", "2", "3", "4"]} />);

    const tabTwo = screen.getByRole("tab", { name: "2" });
    fireEvent.mouseEnter(tabTwo.parentElement as HTMLElement);

    const deleteButton = await screen.findByRole("button", { name: "Delete look 2" });
    expect(deleteButton).toBeInTheDocument();

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: "2" })).not.toBeInTheDocument();
    });
  });

  it("does not suppress tab activation after a simple pointer click sequence", async () => {
    render(<Harness initialPresetIds={["1", "2", "3", "4"]} />);

    const tabFour = screen.getByRole("tab", { name: "4" });
    fireEvent.pointerDown(tabFour, { button: 0, pointerId: 4, clientX: 80, pointerType: "mouse" });
    fireEvent.pointerUp(tabFour, { button: 0, pointerId: 4, clientX: 80, pointerType: "mouse" });
    fireEvent.click(tabFour);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "4" })).toHaveAttribute("aria-selected", "true");
    });
  });

  it("suppresses activation only after an actual drag-scroll gesture", async () => {
    render(<Harness initialPresetIds={["1", "2", "3", "4", "5", "6"]} />);

    const tabTwo = screen.getByRole("tab", { name: "2" });
    fireEvent.pointerDown(tabTwo, { button: 0, pointerId: 7, clientX: 120, pointerType: "mouse" });
    fireEvent.pointerMove(tabTwo, { button: 0, pointerId: 7, clientX: 132, pointerType: "mouse" });
    fireEvent.pointerUp(tabTwo, { button: 0, pointerId: 7, clientX: 132, pointerType: "mouse" });
    fireEvent.click(tabTwo);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "1" })).toHaveAttribute("aria-selected", "true");
    });
  });
});
