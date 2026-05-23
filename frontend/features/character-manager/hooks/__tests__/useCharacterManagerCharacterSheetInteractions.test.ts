import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCharacterManagerCharacterSheetInteractions } from "../useCharacterManagerCharacterSheetInteractions";

describe("useCharacterManagerCharacterSheetInteractions", () => {
  it("clears assigned references even before a character id exists", () => {
    const saveCharacterSheetPresetAssignments = vi.fn();

    const { result } = renderHook(() =>
      useCharacterManagerCharacterSheetInteractions({
        pageBusy: false,
        isDropResolutionBusy: false,
        selectedCharacterId: null,
        pendingCharacterSheetUploadZoneKey: null,
        setPendingCharacterSheetUploadZoneKey: vi.fn(),
        setCharacterSheetPresetFile: vi.fn(),
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
        quickSwapItemById: new Map(),
        quickSwapItemByMediaFileId: new Map(),
        quickSwapItemByLegacySlotKey: new Map(),
        draggedQuickSwapItemId: null,
        draggedCharacterSheetZoneKey: null,
        canResolveCharacterDropReference: false,
        handleCharacterSheetReferenceDrop: vi.fn(),
        setActiveCharacterSheetDropZone: vi.fn(),
        openCharacterSheetPicker: vi.fn(),
        referenceSlotMimeType: "application/x-shortpulse-reference-slot-key",
        characterSheetZoneMimeType: "application/x-shortpulse-character-sheet-zone-key",
      })
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
});
