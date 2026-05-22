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
  const [activePresetId, setActivePresetId] = React.useState<CharacterSheetPresetId>(
    initialActivePresetId ?? initialPresetIds[0] ?? "1"
  );
  const [labels, setLabels] = React.useState(buildLabels);

  return (
    <EmbeddedCharacterLooksControl
      presetIds={initialPresetIds}
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
        const remainingPresetIds = initialPresetIds.filter((id) => id !== presetId);
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
    expect(screen.getByRole("button", { name: "Manage looks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add character look" })).toBeInTheDocument();
  });

  it("reveals hidden looks and explicit actions from the manage menu", () => {
    render(<Harness initialPresetIds={["1", "2", "3", "4", "5"]} initialActivePresetId="5" />);

    expect(screen.queryByRole("tab", { name: "5" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage looks" }));

    expect(screen.getByRole("dialog", { name: "Manage looks menu" })).toBeInTheDocument();
    expect(screen.getByText("Hidden from the compact rail: 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
  });

  it("supports explicit rename without double click", async () => {
    render(<Harness initialPresetIds={["1", "2", "3", "4"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Manage looks" }));
    const renameInput = screen.getByDisplayValue("1");
    fireEvent.change(renameInput, { target: { value: "Hero" } });
    fireEvent.click(screen.getByRole("button", { name: /Save name/i }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Hero" })).toBeInTheDocument();
    });
  });

  it("keeps look 1 undeletable and explains why", () => {
    render(<Harness initialPresetIds={["1", "2", "3", "4"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Manage looks" }));

    expect(screen.queryByRole("button", { name: /^Delete$/i })).not.toBeInTheDocument();
    expect(screen.getByText("Look 1 stays pinned as the fallback look.")).toBeInTheDocument();
  });
});
