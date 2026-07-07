import { describe, expect, it } from "vitest";
import {
  getAllowedSelfServeStorageAddonIds,
  getMinimumSelfServeStorageAddonPlanId,
  getMaximumSelfServeStorageAddonBytes,
  isCurrentBillableStorageAddonStatus,
  resolveStorageAddonEligibility,
} from "../storageAddonEligibility";

describe("storage add-on eligibility", () => {
  it("requires a paid plan for recurring storage add-ons", () => {
    expect(
      resolveStorageAddonEligibility({ planId: "free", storageAddonId: "storage_50gb" })
    ).toMatchObject({
      isEligible: false,
      reason: "paid_plan_required",
    });
  });

  it("limits self-serve storage add-ons by plan tier", () => {
    expect(getAllowedSelfServeStorageAddonIds("starter")).toEqual(["storage_50gb"]);
    expect(getAllowedSelfServeStorageAddonIds("media")).toEqual(["storage_50gb", "storage_100gb"]);
    expect(getAllowedSelfServeStorageAddonIds("studio")).toEqual([
      "storage_50gb",
      "storage_100gb",
      "storage_250gb",
    ]);
    expect(getAllowedSelfServeStorageAddonIds("business")).toEqual([
      "storage_50gb",
      "storage_100gb",
      "storage_250gb",
      "storage_1tb",
    ]);
  });

  it("reports the minimum paid plan for each self-serve storage add-on", () => {
    expect(getMinimumSelfServeStorageAddonPlanId("storage_10gb")).toBeNull();
    expect(getMinimumSelfServeStorageAddonPlanId("storage_50gb")).toBe("starter");
    expect(getMinimumSelfServeStorageAddonPlanId("storage_100gb")).toBe("media");
    expect(getMinimumSelfServeStorageAddonPlanId("storage_250gb")).toBe("studio");
    expect(getMinimumSelfServeStorageAddonPlanId("storage_1tb")).toBe("business");
    expect(getMinimumSelfServeStorageAddonPlanId("storage_500gb")).toBeNull();
  });

  it("marks the 500 GB add-on as manual review only", () => {
    expect(
      resolveStorageAddonEligibility({ planId: "business", storageAddonId: "storage_500gb" })
    ).toMatchObject({
      isManualReviewOnly: true,
      isEligible: false,
      reason: "manual_review_required",
    });
  });

  it("rejects unknown or plan-ineligible add-ons", () => {
    expect(
      resolveStorageAddonEligibility({ planId: "studio", storageAddonId: "storage_1tb" })
    ).toMatchObject({
      isEligible: false,
      reason: "plan_ineligible",
    });
    expect(
      resolveStorageAddonEligibility({ planId: "business", storageAddonId: "storage_25gb" })
    ).toMatchObject({
      isKnownStorageAddon: false,
      isEligible: false,
      reason: "unknown_storage_addon",
    });
    expect(
      resolveStorageAddonEligibility({ planId: "business", storageAddonId: "storage_999gb" })
    ).toMatchObject({
      isKnownStorageAddon: false,
      isEligible: false,
      reason: "unknown_storage_addon",
    });
  });

  it("reports the maximum self-serve add-on capacity by plan", () => {
    expect(getMaximumSelfServeStorageAddonBytes("starter")).toBe(50 * 1024 * 1024 * 1024);
    expect(getMaximumSelfServeStorageAddonBytes("business")).toBe(1024 * 1024 * 1024 * 1024);
  });

  it("matches the quota helper's current billable storage add-on statuses", () => {
    expect(isCurrentBillableStorageAddonStatus("active")).toBe(true);
    expect(isCurrentBillableStorageAddonStatus("trialing")).toBe(true);
    expect(isCurrentBillableStorageAddonStatus("past_due")).toBe(true);
    expect(isCurrentBillableStorageAddonStatus("unpaid")).toBe(false);
    expect(isCurrentBillableStorageAddonStatus("canceled")).toBe(false);
    expect(isCurrentBillableStorageAddonStatus("inactive")).toBe(false);
    expect(isCurrentBillableStorageAddonStatus(null)).toBe(false);
  });
});
