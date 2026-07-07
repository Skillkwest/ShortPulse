import { describe, expect, it } from "vitest";
import { resolveReferenceGridMediaWorkBudget } from "../useReferenceGridMediaWorkBudget";

describe("resolveReferenceGridMediaWorkBudget", () => {
  it("applies level-0 token envelope with shared image/video allocation", () => {
    const budget = resolveReferenceGridMediaWorkBudget({
      enabled: true,
      pressureLevel: 0,
      constrainedProfile: false,
      desiredImageDecodeInflight: 6,
      desiredVideoAttachSlots: 3,
    });

    expect(budget.totalTokens).toBe(8);
    expect(budget.videoAttachBudget).toBe(3);
    expect(budget.imageDecodeBudget).toBe(2);
  });

  it("uses a conservative image-only budget under pressure level 2", () => {
    const budget = resolveReferenceGridMediaWorkBudget({
      enabled: true,
      pressureLevel: 2,
      constrainedProfile: false,
      desiredImageDecodeInflight: 6,
      desiredVideoAttachSlots: 3,
    });

    expect(budget.totalTokens).toBe(3);
    expect(budget.videoAttachBudget).toBe(0);
    expect(budget.imageDecodeBudget).toBe(3);
  });

  it("reserves image lanes before optional video attach work under pressure", () => {
    const budget = resolveReferenceGridMediaWorkBudget({
      enabled: true,
      pressureLevel: 1,
      constrainedProfile: false,
      desiredImageDecodeInflight: 2,
      desiredVideoAttachSlots: 2,
    });

    expect(budget.totalTokens).toBe(6);
    expect(budget.videoAttachBudget).toBe(2);
    expect(budget.imageDecodeBudget).toBe(2);
  });

  it("caps tokens for constrained profiles", () => {
    const budget = resolveReferenceGridMediaWorkBudget({
      enabled: true,
      pressureLevel: 0,
      constrainedProfile: true,
      desiredImageDecodeInflight: 6,
      desiredVideoAttachSlots: 3,
    });

    expect(budget.totalTokens).toBe(5);
    expect(budget.videoAttachBudget).toBe(2);
    expect(budget.imageDecodeBudget).toBe(1);
  });
});
