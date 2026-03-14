/**
 * Tests for canvas drag/drop transfer acceptance helpers.
 * Ensures dragover acceptance does not depend on getData availability.
 */
import { describe, expect, it } from "vitest";
import { canAcceptCanvasDropTransfer } from "../canvasDropController";

const makeTransfer = (options: {
  types: string[];
  data?: Record<string, string>;
  filesLength?: number;
}): DataTransfer =>
  ({
    types: options.types,
    files: {
      length: options.filesLength ?? 0,
      item: () => null,
    } as unknown as FileList,
    getData: (type: string) => options.data?.[type] ?? "",
  }) as unknown as DataTransfer;

describe("canAcceptCanvasDropTransfer", () => {
  it("accepts internal drags from transfer-type hints even when getData is empty", () => {
    const transfer = makeTransfer({
      types: ["text/reference-id", "text/reference-output-id", "text/reference-origin"],
    });

    expect(canAcceptCanvasDropTransfer(transfer)).toBe(true);
  });

  it("accepts text-like drags by transfer type", () => {
    const transfer = makeTransfer({
      types: ["text/plain"],
    });

    expect(canAcceptCanvasDropTransfer(transfer)).toBe(true);
  });

  it("does not accept file-only drags without non-file hints", () => {
    const transfer = makeTransfer({
      types: ["Files"],
      filesLength: 0,
    });

    expect(canAcceptCanvasDropTransfer(transfer)).toBe(false);
  });
});
