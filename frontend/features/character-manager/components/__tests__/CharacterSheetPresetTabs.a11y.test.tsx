/**
 * Character Sheet preset tabs accessibility tests.
 * Verifies ARIA semantics, roving tabindex, add-tab flow, rename behavior, and tab deletion affordances.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CHARACTER_SHEET_PRESET_IDS } from "../../constants";
import type { CharacterSheetPresetId } from "../../types";
import { getNextCharacterSheetPresetId } from "../../logic/characterSheetPresetTabs";
import {
  CharacterSheetPresetTabs,
  getCharacterSheetPresetTabId,
} from "../CharacterSheetPresetTabs";

function PresetTabsHarness({
  initialPresetIds = ["1"] as CharacterSheetPresetId[],
}: {
  initialPresetIds?: CharacterSheetPresetId[];
}) {
  const [activePresetId, setActivePresetId] = React.useState<CharacterSheetPresetId>("1");
  const [presetIds, setPresetIds] = React.useState<CharacterSheetPresetId[]>(initialPresetIds);
  const [presetLabels, setPresetLabels] = React.useState<Record<CharacterSheetPresetId, string>>(
    () =>
      Object.fromEntries(
        CHARACTER_SHEET_PRESET_IDS.map((presetId) => [presetId, presetId])
      ) as Record<CharacterSheetPresetId, string>
  );
  const idBase = "character-sheet-preset-test";
  const panelId = "character-sheet-preset-panel-test";

  return (
    <>
      <CharacterSheetPresetTabs
        presetIds={presetIds}
        activePresetId={activePresetId}
        presetLabels={presetLabels}
        onSelectPreset={(presetId) => {
          setActivePresetId(presetId);
        }}
        onAddPreset={() => {
          const nextPresetId = getNextCharacterSheetPresetId(presetIds);
          if (!nextPresetId) return;
          setPresetIds((previous) => [...previous, nextPresetId]);
          setActivePresetId(nextPresetId);
          setPresetLabels((previous) => ({
            ...previous,
            [nextPresetId]: previous[nextPresetId] ?? nextPresetId,
          }));
        }}
        onRenamePreset={(presetId, nextLabel) => {
          const normalizedLabel = nextLabel.trim() || presetId;
          setPresetLabels((previous) => ({
            ...previous,
            [presetId]: normalizedLabel,
          }));
        }}
        onDeletePreset={(presetId) => {
          setPresetIds((previous) => {
            const nextIds = previous.filter((id) => id !== presetId);
            const nextActiveId = activePresetId === presetId ? (nextIds[0] ?? "1") : activePresetId;
            setActivePresetId(nextActiveId);
            return nextIds;
          });
          setPresetLabels((previous) => ({
            ...previous,
            [presetId]: presetId,
          }));
        }}
        panelId={panelId}
        idBase={idBase}
      />
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={getCharacterSheetPresetTabId(idBase, activePresetId)}
      />
    </>
  );
}

describe("CharacterSheetPresetTabs accessibility", () => {
  it("renders tab semantics with roving tabindex and panel linkage", () => {
    render(<PresetTabsHarness />);

    const tabList = screen.getByRole("tablist", { name: "Character sheet style presets" });
    const tabOne = screen.getByRole("tab", { name: "1" });
    const panel = screen.getByRole("tabpanel");

    expect(tabList).toHaveAttribute("aria-orientation", "horizontal");
    expect(tabOne).toHaveAttribute("aria-selected", "true");
    expect(tabOne).toHaveAttribute("tabindex", "0");
    expect(tabOne).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tabOne.id);
    expect(
      screen.getByRole("button", { name: "Add character sheet preset tab" })
    ).toBeInTheDocument();
  });

  it("supports ArrowLeft/ArrowRight wrap plus Home/End selection", () => {
    render(<PresetTabsHarness />);
    const addButton = screen.getByRole("button", { name: "Add character sheet preset tab" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const tabOne = screen.getByRole("tab", { name: "1" });
    fireEvent.keyDown(tabOne, { key: "ArrowLeft" });

    const tabFour = screen.getByRole("tab", { name: "4" });
    expect(tabFour).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(tabFour);

    fireEvent.keyDown(tabFour, { key: "ArrowRight" });
    expect(tabOne).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(tabOne);

    fireEvent.keyDown(tabOne, { key: "End" });
    expect(tabFour).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(tabFour);

    fireEvent.keyDown(tabFour, { key: "Home" });
    expect(tabOne).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(tabOne);
  });

  it("activates tabs on Enter and Space", () => {
    render(<PresetTabsHarness />);
    const addButton = screen.getByRole("button", { name: "Add character sheet preset tab" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const tabOne = screen.getByRole("tab", { name: "1" });
    fireEvent.keyDown(tabOne, { key: "ArrowRight" });
    const tabTwo = screen.getByRole("tab", { name: "2" });
    expect(tabTwo).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tabTwo, { key: "ArrowRight" });
    const tabThree = screen.getByRole("tab", { name: "3" });
    expect(tabThree).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tabThree, { key: "Enter" });
    expect(tabThree).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tabThree, { key: "ArrowRight" });
    const tabFour = screen.getByRole("tab", { name: "4" });
    expect(tabFour).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tabFour, { key: " " });
    expect(tabFour).toHaveAttribute("aria-selected", "true");
  });

  it("supports inline rename with Enter and Escape", () => {
    render(<PresetTabsHarness />);

    const tabOne = screen.getByRole("tab", { name: "1" });
    fireEvent.doubleClick(tabOne);
    const renameInput = screen.getByLabelText("Rename preset 1");
    fireEvent.change(renameInput, { target: { value: "Hero Look" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    expect(screen.getByRole("tab", { name: "Hero Look" })).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByRole("tab", { name: "Hero Look" }));
    const secondRenameInput = screen.getByLabelText("Rename preset 1");
    fireEvent.change(secondRenameInput, { target: { value: "Temporary" } });
    fireEvent.keyDown(secondRenameInput, { key: "Escape" });

    expect(screen.getByRole("tab", { name: "Hero Look" })).toBeInTheDocument();
  });

  it("hides add button when at max visible tabs", () => {
    render(
      <PresetTabsHarness
        initialPresetIds={CHARACTER_SHEET_PRESET_IDS as CharacterSheetPresetId[]}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Add character sheet preset tab" })
    ).not.toBeInTheDocument();
  });

  it("shows delete controls for tabs after the first and supports deleting a tab", () => {
    render(<PresetTabsHarness initialPresetIds={["1", "2", "3"]} />);

    expect(screen.queryByRole("button", { name: "Delete preset 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete preset 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete preset 3" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete preset 2" }));

    expect(screen.queryByRole("tab", { name: "2" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "3" })).toBeInTheDocument();
  });
});
