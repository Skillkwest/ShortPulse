/**
 * Validates user-facing bulk move feedback states.
 */
import { describe, expect, it } from "vitest";
import { buildBulkMoveFeedback } from "../bulkMoveFeedback";

describe("buildBulkMoveFeedback", () => {
  it("returns success notice and tab-switch signal for full success", () => {
    const feedback = buildBulkMoveFeedback({
      movedCount: 3,
      requestedCount: 3,
      failedCount: 0,
      destinationLabel: "Private",
    });

    expect(feedback.notice).toBe("3 selected files moved to Private.");
    expect(feedback.error).toBeNull();
    expect(feedback.shouldSwitchTab).toBe(true);
  });

  it("returns partial notice and error without tab-switch for partial success", () => {
    const feedback = buildBulkMoveFeedback({
      movedCount: 2,
      requestedCount: 5,
      failedCount: 3,
      destinationLabel: "AI Studio Generations",
      firstFailureMessage: "File A: Invalid move destination",
    });

    expect(feedback.notice).toBe("2 of 5 selected files moved to AI Studio Generations.");
    expect(feedback.error).toBe("3 files failed to move. File A: Invalid move destination");
    expect(feedback.shouldSwitchTab).toBe(false);
  });

  it("returns failure error when nothing moved", () => {
    const feedback = buildBulkMoveFeedback({
      movedCount: 0,
      requestedCount: 4,
      failedCount: 4,
      destinationLabel: "Uploaded Images",
      firstFailureMessage: "File B: Media file not found",
    });

    expect(feedback.notice).toBeNull();
    expect(feedback.error).toBe("Unable to move selected files. File B: Media file not found");
    expect(feedback.shouldSwitchTab).toBe(false);
  });
});
