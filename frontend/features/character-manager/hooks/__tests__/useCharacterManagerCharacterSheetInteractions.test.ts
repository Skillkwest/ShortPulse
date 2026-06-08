import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCharacterManagerCharacterSheetInteractions } from "../useCharacterManagerCharacterSheetInteractions";
import type { CharacterSheetPresetMediaReference } from "../../types";

const createMediaReference = (
  characterMediaId: string,
  previewUrl = `https://example.com/${characterMediaId}.png`
): CharacterSheetPresetMediaReference => ({
  characterMediaId,
  storagePath: `${characterMediaId}.png`,
  previewUrl,
});

const createParams = (
  overrides: Partial<Parameters<typeof useCharacterManagerCharacterSheetInteractions>[0]> = {}
): Parameters<typeof useCharacterManagerCharacterSheetInteractions>[0] => ({
  intakeBusy: false,
  slotMutationBusy: false,
  isAnyCharacterSheetSlotPending: false,
  isCharacterSheetSlotPending: () => false,
  pendingCharacterSheetUploadZoneKey: null,
  setPendingCharacterSheetUploadZoneKey: vi.fn(),
  setCharacterSheetPresetFile: vi.fn(),
  resolvedCharacterSheetPresetAssignments: {
    portrait: null,
    close_up: null,
    front_shot: null,
  },
  saveCharacterSheetPresetAssignments: vi.fn(),
  draggedCharacterSheetZoneKey: null,
  canResolveCharacterDropReference: false,
  handleCharacterSheetReferenceDrop: vi.fn(),
  setActiveCharacterSheetDropZone: vi.fn(),
  openCharacterSheetPicker: vi.fn(),
  characterSheetZoneMimeType: "application/x-shortpulse-character-sheet-zone-key",
  ...overrides,
});

describe("useCharacterManagerCharacterSheetInteractions", () => {
  it("clears assigned references even before a character id exists", () => {
    const saveCharacterSheetPresetAssignments = vi.fn();

    const { result } = renderHook(() =>
      useCharacterManagerCharacterSheetInteractions(
        createParams({
          resolvedCharacterSheetPresetAssignments: {
            portrait: {
              characterMediaId: "local-1",
              storagePath: "",
              previewUrl: "blob:portrait-preview",
            },
            close_up: null,
            front_shot: null,
          },
          saveCharacterSheetPresetAssignments,
        })
      )
    );

    act(() => {
      result.current.clearCharacterSheetAssignment("portrait");
    });

    expect(saveCharacterSheetPresetAssignments).toHaveBeenCalledWith({
      portrait: null,
      close_up: null,
      front_shot: null,
    });
  });

  it("keeps other empty slots clickable while a different slot is pending", () => {
    const openCharacterSheetPicker = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagerCharacterSheetInteractions(
        createParams({
          isAnyCharacterSheetSlotPending: true,
          isCharacterSheetSlotPending: (zoneKey) => zoneKey === "portrait",
          openCharacterSheetPicker,
        })
      )
    );

    act(() => {
      result.current.handleCharacterSheetCardClick("close_up")();
    });
    act(() => {
      result.current.handleCharacterSheetCardClick("portrait")();
    });

    expect(openCharacterSheetPicker).toHaveBeenCalledTimes(1);
    expect(openCharacterSheetPicker).toHaveBeenCalledWith("close_up");
  });

  it("lets the direct picker save into another slot while a different slot is pending", () => {
    const setPendingCharacterSheetUploadZoneKey = vi.fn();
    const setCharacterSheetPresetFile = vi.fn();
    const file = new File(["close-up"], "close-up.png", { type: "image/png" });
    const { result } = renderHook(() =>
      useCharacterManagerCharacterSheetInteractions(
        createParams({
          isAnyCharacterSheetSlotPending: true,
          isCharacterSheetSlotPending: (zoneKey) => zoneKey === "portrait",
          pendingCharacterSheetUploadZoneKey: "close_up",
          setPendingCharacterSheetUploadZoneKey,
          setCharacterSheetPresetFile,
        })
      )
    );

    act(() => {
      result.current.handleCharacterSheetFileSelection({
        target: {
          files: [file],
          value: "filled",
        },
      } as never);
    });

    expect(setPendingCharacterSheetUploadZoneKey).toHaveBeenCalledWith(null);
    expect(setCharacterSheetPresetFile).toHaveBeenCalledWith("close_up", file);
  });

  it("keeps internal slot swap blocked while any slot upload is pending", () => {
    const saveCharacterSheetPresetAssignments = vi.fn();
    const setActiveCharacterSheetDropZone = vi.fn();
    const preventDefault = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagerCharacterSheetInteractions(
        createParams({
          slotMutationBusy: true,
          isAnyCharacterSheetSlotPending: true,
          resolvedCharacterSheetPresetAssignments: {
            portrait: {
              characterMediaId: "portrait-media",
              storagePath: "portrait.png",
              previewUrl: "https://example.com/portrait.png",
            },
            close_up: null,
            front_shot: null,
          },
          saveCharacterSheetPresetAssignments,
          draggedCharacterSheetZoneKey: "portrait",
          setActiveCharacterSheetDropZone,
        })
      )
    );

    act(() => {
      result.current.handleCharacterSheetDrop("close_up")({
        preventDefault,
        dataTransfer: {
          getData: () => "portrait",
        },
      } as never);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(setActiveCharacterSheetDropZone).toHaveBeenCalledWith(null);
    expect(saveCharacterSheetPresetAssignments).not.toHaveBeenCalled();
  });

  it("swaps assignments when a character reference is dropped onto another filled slot", () => {
    const saveCharacterSheetPresetAssignments = vi.fn();
    const setActiveCharacterSheetDropZone = vi.fn();
    const preventDefault = vi.fn();
    const portraitReference = createMediaReference("portrait-media");
    const closeUpReference = createMediaReference("close-up-media");
    const { result } = renderHook(() =>
      useCharacterManagerCharacterSheetInteractions(
        createParams({
          resolvedCharacterSheetPresetAssignments: {
            portrait: portraitReference,
            close_up: closeUpReference,
            front_shot: null,
          },
          saveCharacterSheetPresetAssignments,
          draggedCharacterSheetZoneKey: "portrait",
          setActiveCharacterSheetDropZone,
        })
      )
    );

    act(() => {
      result.current.handleCharacterSheetDrop("close_up")({
        preventDefault,
        dataTransfer: {
          getData: () => "portrait",
        },
      } as never);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(setActiveCharacterSheetDropZone).toHaveBeenCalledWith(null);
    expect(saveCharacterSheetPresetAssignments).toHaveBeenCalledWith({
      portrait: closeUpReference,
      close_up: portraitReference,
      front_shot: null,
    });
  });

  it("moves an assignment when a character reference is dropped onto an empty slot", () => {
    const saveCharacterSheetPresetAssignments = vi.fn();
    const portraitReference = createMediaReference("portrait-media");
    const { result } = renderHook(() =>
      useCharacterManagerCharacterSheetInteractions(
        createParams({
          resolvedCharacterSheetPresetAssignments: {
            portrait: portraitReference,
            close_up: null,
            front_shot: null,
          },
          saveCharacterSheetPresetAssignments,
          draggedCharacterSheetZoneKey: "portrait",
        })
      )
    );

    act(() => {
      result.current.handleCharacterSheetDrop("front_shot")({
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: () => "portrait",
        },
      } as never);
    });

    expect(saveCharacterSheetPresetAssignments).toHaveBeenCalledWith({
      portrait: null,
      close_up: null,
      front_shot: portraitReference,
    });
  });
});
