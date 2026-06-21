import { describe, expect, it } from "vitest";

import { resolveGenerateCreditConfidence } from "../generateCreditConfidence";

const formatCredits = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

describe("resolveGenerateCreditConfidence", () => {
  it("marks the action covered when the balance covers the displayed cost", () => {
    expect(
      resolveGenerateCreditConfidence({
        actionLabel: "Generate music",
        estimatedCredits: 8,
        balanceCredits: 10000,
        formatCredits,
      })
    ).toEqual({
      summary: "Balance covers this run",
      title: "Generate music, costs 8 credits, balance 10000 credits",
      status: "covered",
    });
  });

  it("marks a shortfall without hiding the displayed cost", () => {
    expect(
      resolveGenerateCreditConfidence({
        actionLabel: "Generate sound effect",
        estimatedCredits: 8.5,
        balanceCredits: 3,
        formatCredits,
      })
    ).toEqual({
      summary: "Needs 5.5 credits more",
      title: "Generate sound effect, costs 8.5 credits, balance 3 credits, short by 5.5 credits",
      status: "short",
    });
  });

  it("keeps unknown status when cost or balance is unavailable", () => {
    expect(
      resolveGenerateCreditConfidence({
        actionLabel: "Generate voiceover",
        estimatedCredits: null,
        balanceCredits: null,
        formatCredits,
      })
    ).toEqual({
      summary: "Cost unavailable",
      title: "Generate voiceover, cost unavailable, balance unavailable",
      status: "unknown",
    });
  });
});
