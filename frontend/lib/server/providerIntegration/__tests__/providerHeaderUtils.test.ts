/**
 * Unit coverage for provider header utility helpers.
 */

import { describe, expect, it } from "vitest";
import { parseBooleanHeader } from "../providerHeaderUtils";

describe("providerHeaderUtils", () => {
  it("parses true/false header values case-insensitively", () => {
    expect(parseBooleanHeader("true")).toBe(true);
    expect(parseBooleanHeader("TRUE")).toBe(true);
    expect(parseBooleanHeader(" false ")).toBe(false);
  });

  it("returns null for invalid or missing header values", () => {
    expect(parseBooleanHeader("1")).toBeNull();
    expect(parseBooleanHeader("yes")).toBeNull();
    expect(parseBooleanHeader(null)).toBeNull();
  });
});
