/**
 * Character Sheet preset tabs accessibility tests.
 * Verifies ARIA semantics, roving tabindex, and keyboard navigation behavior.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CHARACTER_SHEET_PRESET_IDS } from "../../constants";
import type { CharacterSheetPresetId } from "../../types";
import {
  CharacterSheetPresetTabs,
  getCharacterSheetPresetTabId,
} from "../CharacterSheetPresetTabs";

function PresetTabsHarness() {
  const [activePresetId, setActivePresetId] = React.useState<CharacterSheetPresetId>("1");
  const idBase = "character-sheet-preset-test";
  const panelId = "character-sheet-preset-panel-test";

  return (
    <>
      <CharacterSheetPresetTabs
        presetIds={CHARACTER_SHEET_PRESET_IDS}
        activePresetId={activePresetId}
        onSelectPreset={(presetId) => {
          setActivePresetId(presetId);
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
    const tabTwo = screen.getByRole("tab", { name: "2" });
    const panel = screen.getByRole("tabpanel");

    expect(tabList).toHaveAttribute("aria-orientation", "horizontal");
    expect(tabOne).toHaveAttribute("aria-selected", "true");
    expect(tabOne).toHaveAttribute("tabindex", "0");
    expect(tabTwo).toHaveAttribute("aria-selected", "false");
    expect(tabTwo).toHaveAttribute("tabindex", "-1");
    expect(tabOne).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tabOne.id);
  });

  it("supports ArrowLeft/ArrowRight wrap plus Home/End selection", () => {
    render(<PresetTabsHarness />);

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
});
