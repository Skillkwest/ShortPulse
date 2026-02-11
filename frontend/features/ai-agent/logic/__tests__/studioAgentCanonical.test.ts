import {
  isExplicitEditRequest,
  isNoOpEditResponse,
  preservesContext,
  resolveCanonicalPrompt,
  shouldRetryExplicitNoOp,
} from "../studioAgentCanonical";

describe("studioAgentCanonical", () => {
  it("detects explicit edit requests", () => {
    expect(isExplicitEditRequest("remove the cactus and replace it with dunes")).toBe(true);
    expect(isExplicitEditRequest("make this a border collie")).toBe(true);
    expect(isExplicitEditRequest("give me a stronger cinematic version")).toBe(false);
  });

  it("detects no-op edits after normalization", () => {
    expect(
      isNoOpEditResponse(
        "A Border Collie in a barren wasteland.",
        "a border collie in a barren wasteland"
      )
    ).toBe(true);
    expect(
      isNoOpEditResponse(
        "A Border Collie in a barren wasteland.",
        "A Border Collie in a lush field."
      )
    ).toBe(false);
  });

  it("checks context preservation against significant tokens", () => {
    const canonical =
      "A black and white border collie stands in a barren wasteland under harsh sunlight.";
    expect(
      preservesContext(canonical, "A black and white border collie in a barren wasteland at dusk.")
    ).toBe(true);
    expect(preservesContext(canonical, "A red sports car parked beside a tropical beach.")).toBe(
      false
    );
  });

  it("retries only when an explicit edit request returned a no-op", () => {
    expect(
      shouldRetryExplicitNoOp({
        userInput: "remove all plants and make the dog a border collie",
        effectiveCanonical: "A dog in a desert with grass and cactus.",
        nextCanonical: "A dog in a desert with grass and cactus.",
      })
    ).toBe(true);

    expect(
      shouldRetryExplicitNoOp({
        userInput: "enhance the atmosphere with richer detail",
        effectiveCanonical: "A dog in a desert with grass and cactus.",
        nextCanonical: "A dog in a desert with grass and cactus.",
      })
    ).toBe(false);
  });

  it("resolves canonical prompt from first non-empty candidate", () => {
    expect(resolveCanonicalPrompt("  ", null, "  prompt A  ", "prompt B")).toBe("prompt A");
    expect(resolveCanonicalPrompt(undefined, "", null)).toBeNull();
  });
});
