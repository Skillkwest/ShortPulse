import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCharacterManagerDroppedReferenceController } from "../useCharacterManagerDroppedReferenceController";
import { reportAppError } from "../../../../lib/appErrorReporter";

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: vi.fn(),
}));

describe("useCharacterManagerDroppedReferenceController", () => {
  it("uploads a locally dropped file directly into the requested character-sheet zone", async () => {
    const setCharacterSheetPresetFile = vi.fn().mockResolvedValue(true);
    const file = new File(["image-bytes"], "portrait.png", { type: "image/png" });
    const transfer = {
      files: [file],
      items: [],
      types: ["Files"],
      getData: () => "",
    } as unknown as DataTransfer;

    const { result } = renderHook(() =>
      useCharacterManagerDroppedReferenceController({
        pageBusy: false,
        quickSwapMutating: false,
        clearAllMessages: vi.fn(),
        appendQuickSwapFiles: vi.fn(async () => false),
        setCharacterSheetPresetFile,
        hasQuickSwapMediaFileId: () => false,
      })
    );

    await act(async () => {
      await result.current.handleCharacterSheetReferenceDrop("portrait", transfer);
    });

    expect(setCharacterSheetPresetFile).toHaveBeenCalledWith("portrait", file);
    expect(vi.mocked(reportAppError)).not.toHaveBeenCalled();
    expect(result.current.pendingDropTarget).toBeNull();
  });
});
