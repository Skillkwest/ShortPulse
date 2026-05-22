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
      onAddPreset={() => undefined}
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

    fireEvent.click(screen.getByRole("tab", { name: "3" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "3" })).toHaveAttribute("aria-selected", "true");
    });
  });

  it("keeps the add button available without extra options chrome", () => {
    render(<Harness initialPresetIds={["1", "2", "3", "4"]} />);

    expect(screen.getByRole("button", { name: "Add character look" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage looks" })).not.toBeInTheDocument();
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
});
