/**
 * Regression tests for admin user-health deep-diagnostics parsing helpers.
 */
import { describe, expect, it } from "vitest";
import { asPositiveInt } from "../../lib/server/adminUserHealth/deep";

describe("admin user-health deep parsing", () => {
  it("uses the fallback for absent or empty positive integer inputs", () => {
    expect(asPositiveInt(null, 30)).toBe(30);
    expect(asPositiveInt(undefined, 30)).toBe(30);
    expect(asPositiveInt("", 30)).toBe(30);
  });

  it("clamps positive integer inputs to at least one", () => {
    expect(asPositiveInt("0", 30)).toBe(1);
    expect(asPositiveInt("-5", 30)).toBe(1);
    expect(asPositiveInt("12.8", 30)).toBe(12);
  });
});
