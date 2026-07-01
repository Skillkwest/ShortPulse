import { describe, expect, it } from "vitest";

import { BYTES_PER_GIB, getDefaultPlanStorageLimitBytes } from "../storage";

describe("getDefaultPlanStorageLimitBytes", () => {
  it("keeps hidden baseline access storage-free while preserving paid tier fallbacks", () => {
    expect(getDefaultPlanStorageLimitBytes("free")).toBe(0);
    expect(getDefaultPlanStorageLimitBytes(undefined)).toBe(0);
    expect(getDefaultPlanStorageLimitBytes("starter")).toBe(5 * BYTES_PER_GIB);
    expect(getDefaultPlanStorageLimitBytes("media")).toBe(25 * BYTES_PER_GIB);
    expect(getDefaultPlanStorageLimitBytes("studio")).toBe(75 * BYTES_PER_GIB);
    expect(getDefaultPlanStorageLimitBytes("business")).toBe(150 * BYTES_PER_GIB);
  });
});
