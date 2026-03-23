/**
 * Direct unit coverage for fleet query helper normalization.
 */
import { describe, expect, it } from "vitest";
import {
  chunk,
  isSchemaCompatibilityError,
  normalizeQueryError,
  parseTimestamp,
  toNumber,
} from "../../lib/server/adminUserHealth/fleetQueryUtils";

describe("adminUserHealth fleetQueryUtils", () => {
  it("normalizes query errors from unknown objects", () => {
    expect(normalizeQueryError(null)).toBeNull();
    expect(normalizeQueryError("boom")).toBeNull();
    expect(normalizeQueryError({ message: "missing column", code: "42703" })).toEqual({
      message: "missing column",
      code: "42703",
    });
    expect(normalizeQueryError({ message: 42, code: 99 })).toEqual({
      message: undefined,
      code: undefined,
    });
  });

  it("detects schema compatibility errors by code and message", () => {
    expect(isSchemaCompatibilityError({ code: "42703" })).toBe(true);
    expect(isSchemaCompatibilityError({ code: "PGRST204" })).toBe(true);
    expect(
      isSchemaCompatibilityError({ message: "Could not find the table in schema cache." })
    ).toBe(true);
    expect(isSchemaCompatibilityError({ message: "permission denied" })).toBe(false);
    expect(isSchemaCompatibilityError(null)).toBe(false);
  });

  it("parses timestamps and numeric values defensively", () => {
    expect(parseTimestamp("2026-03-14T16:00:00.000Z")).toBeTypeOf("number");
    expect(parseTimestamp("not-a-date")).toBeNull();
    expect(parseTimestamp(null)).toBeNull();

    expect(toNumber("42.5")).toBe(42.5);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("not-a-number")).toBe(0);
  });

  it("chunks rows into stable page slices", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
