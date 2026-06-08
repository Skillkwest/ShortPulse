import { describe, expect, it } from "vitest";
import { swapElementImageReferenceSlots } from "../elementReferenceSlots";

describe("swapElementImageReferenceSlots", () => {
  it("swaps populated source and target reference slots", () => {
    expect(
      swapElementImageReferenceSlots(
        ["https://example.com/a.png", "https://example.com/b.png"],
        0,
        1
      )
    ).toEqual(["https://example.com/b.png", "https://example.com/a.png"]);
  });

  it("moves a populated source reference into an empty target slot", () => {
    expect(swapElementImageReferenceSlots(["https://example.com/a.png"], 0, 2)).toEqual([
      "",
      "",
      "https://example.com/a.png",
    ]);
  });

  it("ignores empty, invalid, and no-op source slots", () => {
    expect(swapElementImageReferenceSlots(["", "https://example.com/b.png"], 0, 1)).toBeNull();
    expect(swapElementImageReferenceSlots(["https://example.com/a.png"], 0, 0)).toBeNull();
    expect(swapElementImageReferenceSlots(["https://example.com/a.png"], -1, 1)).toBeNull();
    expect(swapElementImageReferenceSlots(["https://example.com/a.png"], 0, 6)).toBeNull();
  });
});
