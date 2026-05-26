/**
 * Character Sheet look tabs accessibility tests.
 * Verifies ARIA semantics, roving tabindex, add-tab flow, rename behavior, and tab deletion affordances.
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CHARACTER_SHEET_PRESET_IDS,
  getDefaultCharacterSheetPresetTabLabel,
} from "../../constants";
import type { CharacterSheetPresetId } from "../../types";
import {
  getCharacterSheetPresetTabId,
  getNextCharacterSheetPresetId,
} from "../../logic/characterSheetPresetTabs";
import { CharacterSheetPresetTabs } from "../CharacterSheetPresetTabs";

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
        CHARACTER_SHEET_PRESET_IDS.map((presetId) => [
          presetId,
          getDefaultCharacterSheetPresetTabLabel(presetId),
        ])
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
            [nextPresetId]:
              previous[nextPresetId] ?? getDefaultCharacterSheetPresetTabLabel(nextPresetId),
          }));
        }}
        onRenamePreset={(presetId, nextLabel) => {
          const normalizedLabel =
            nextLabel.trim() || getDefaultCharacterSheetPresetTabLabel(presetId);
          setPresetLabels((previous) => ({
            ...previous,
            [presetId]: normalizedLabel,
          }));
        }}
        onDeletePreset={(presetId) => {
          setPresetIds((previous) => {
            const deletedIndex = previous.indexOf(presetId);
            const nextIds = previous.filter((id) => id !== presetId);
            const nearestLeftId = deletedIndex > 0 ? (previous[deletedIndex - 1] ?? null) : null;
            const nearestRightId = deletedIndex >= 0 ? (previous[deletedIndex + 1] ?? null) : null;
            const nextActiveId =
              activePresetId === presetId
                ? (nearestLeftId ?? nearestRightId ?? nextIds[0] ?? "1")
                : activePresetId;
            setActivePresetId(nextActiveId);
            return nextIds;
          });
          setPresetLabels((previous) => ({
            ...previous,
            [presetId]: getDefaultCharacterSheetPresetTabLabel(presetId),
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
  const tabOneDefaultLabel = getDefaultCharacterSheetPresetTabLabel("1");

  it("renders tab semantics with roving tabindex and panel linkage", () => {
    render(<PresetTabsHarness />);

    const tabList = screen.getByRole("tablist", { name: "Character looks" });
    const tabOne = screen.getByRole("tab", { name: tabOneDefaultLabel });
    const panel = screen.getByRole("tabpanel");

    expect(tabList).toHaveAttribute("aria-orientation", "horizontal");
    expect(tabOne).toHaveAttribute("aria-selected", "true");
    expect(tabOne).toHaveAttribute("tabindex", "0");
    expect(tabOne).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tabOne.id);
    expect(screen.getByRole("button", { name: "Add character look" })).toBeInTheDocument();
  });

  it("supports ArrowLeft/ArrowRight wrap plus Home/End selection", () => {
    render(<PresetTabsHarness />);
    const addButton = screen.getByRole("button", { name: "Add character look" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const tabOne = screen.getByRole("tab", { name: tabOneDefaultLabel });
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
    const addButton = screen.getByRole("button", { name: "Add character look" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const tabOne = screen.getByRole("tab", { name: tabOneDefaultLabel });
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

    const tabOne = screen.getByRole("tab", { name: tabOneDefaultLabel });
    fireEvent.doubleClick(tabOne);
    const renameInput = screen.getByLabelText("Rename look 1");
    fireEvent.change(renameInput, { target: { value: "Hero Look" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    expect(screen.getByRole("tab", { name: "Hero Look" })).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByRole("tab", { name: "Hero Look" }));
    const secondRenameInput = screen.getByLabelText("Rename look 1");
    fireEvent.change(secondRenameInput, { target: { value: "Temporary" } });
    fireEvent.keyDown(secondRenameInput, { key: "Escape" });

    expect(screen.getByRole("tab", { name: "Hero Look" })).toBeInTheDocument();
  });

  it("hides add button when at max visible tabs", () => {
    render(
      <PresetTabsHarness
        initialPresetIds={[...CHARACTER_SHEET_PRESET_IDS] as CharacterSheetPresetId[]}
      />
    );

    expect(screen.queryByRole("button", { name: "Add character look" })).not.toBeInTheDocument();
  });

  it("shows delete controls for tabs after the first and supports deleting a tab", () => {
    render(<PresetTabsHarness initialPresetIds={["1", "2", "3"]} />);

    expect(screen.queryByRole("button", { name: "Delete look 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete look 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete look 3" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete look 2" }));

    expect(screen.queryByRole("tab", { name: "2" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: tabOneDefaultLabel })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "3" })).toBeInTheDocument();
  });

  it("keeps tab semantics intact and dispatches delete for the matching preset", () => {
    const onDeletePreset = vi.fn();
    render(
      <CharacterSheetPresetTabs
        presetIds={["1", "2", "3"]}
        activePresetId="1"
        presetLabels={{
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
        }}
        onSelectPreset={() => undefined}
        onAddPreset={() => undefined}
        onDeletePreset={onDeletePreset}
        panelId="panel-id"
      />
    );

    const tablist = screen.getByRole("tablist", { name: "Character looks" });
    expect(within(tablist).getAllByRole("tab")).toHaveLength(3);
    expect(within(tablist).getByRole("button", { name: "Delete look 2" })).toBeInTheDocument();
    expect(
      within(tablist).queryByRole("button", { name: "Add character look" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete look 3" }));
    expect(onDeletePreset).toHaveBeenCalledWith("3");
    expect(onDeletePreset).toHaveBeenCalledTimes(1);
  });

  it("supports click-and-drag horizontal scrolling on the tab rail", () => {
    const { container } = render(
      <PresetTabsHarness initialPresetIds={["1", "2", "3", "4", "5", "6"]} />
    );
    const tabTrack = container.querySelector(
      ".character-sheet-preset-tab-track"
    ) as HTMLDivElement | null;
    expect(tabTrack).not.toBeNull();
    if (!tabTrack) return;

    let currentScrollLeft = 0;
    Object.defineProperty(tabTrack, "scrollLeft", {
      configurable: true,
      get: () => currentScrollLeft,
      set: (value: number) => {
        currentScrollLeft = value;
      },
    });

    fireEvent.pointerDown(tabTrack, { button: 0, pointerId: 1, clientX: 220 });
    fireEvent.pointerMove(tabTrack, { pointerId: 1, clientX: 150 });
    fireEvent.pointerUp(tabTrack, { pointerId: 1, clientX: 150 });

    expect(currentScrollLeft).toBe(70);
  });

  it("preserves delete-button click behavior when pointer interactions occur on the delete target", () => {
    const onDeletePreset = vi.fn();
    render(
      <CharacterSheetPresetTabs
        presetIds={["1", "2", "3"]}
        activePresetId="1"
        presetLabels={{
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
        }}
        onSelectPreset={() => undefined}
        onAddPreset={() => undefined}
        onDeletePreset={onDeletePreset}
        panelId="panel-id"
      />
    );

    const deletePresetTwo = screen.getByRole("button", { name: "Delete look 2" });
    fireEvent.pointerDown(deletePresetTwo, { button: 0, pointerId: 9, clientX: 220 });
    fireEvent.pointerMove(deletePresetTwo, { pointerId: 9, clientX: 212 });
    fireEvent.pointerUp(deletePresetTwo, { pointerId: 9, clientX: 212 });
    fireEvent.click(deletePresetTwo);

    expect(onDeletePreset).toHaveBeenCalledWith("2");
    expect(onDeletePreset).toHaveBeenCalledTimes(1);
  });

  it("preserves tab selection clicks when pointer moves stay below drag activation threshold", () => {
    render(<PresetTabsHarness initialPresetIds={["1", "2", "3"]} />);
    const tabTwo = screen.getByRole("tab", { name: "2" });

    fireEvent.pointerDown(tabTwo, { button: 0, pointerId: 11, clientX: 200 });
    fireEvent.pointerMove(tabTwo, { pointerId: 11, clientX: 196 });
    fireEvent.pointerUp(tabTwo, { pointerId: 11, clientX: 196 });
    fireEvent.click(tabTwo);

    expect(tabTwo).toHaveAttribute("aria-selected", "true");
  });
});
