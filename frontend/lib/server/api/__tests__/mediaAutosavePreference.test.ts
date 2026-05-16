import { describe, expect, it, vi } from "vitest";
import {
  readMediaAutosaveEnabledForUser,
  resolveMediaAutosavePreferenceLookupUserMessage,
} from "../mediaAutosavePreference";

const buildSupabaseAdmin = (result: { data: unknown; error: unknown }) => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => result),
      })),
    })),
  })),
});

describe("readMediaAutosaveEnabledForUser", () => {
  it("defaults to enabled when the user has no stored preference row", async () => {
    const preference = await readMediaAutosaveEnabledForUser({
      userId: "user-1",
      supabaseAdmin: buildSupabaseAdmin({ data: null, error: null }) as never,
    });

    expect(preference).toEqual({
      enabled: true,
      source: "default_missing_row",
    });
  });

  it("fails closed when the preference lookup errors", async () => {
    const preference = await readMediaAutosaveEnabledForUser({
      userId: "user-1",
      supabaseAdmin: buildSupabaseAdmin({
        data: null,
        error: { message: "lookup failed" },
      }) as never,
    });

    expect(preference).toEqual({
      enabled: false,
      source: "lookup_error",
    });
  });

  it("returns a user-safe message for lookup failures", () => {
    expect(
      resolveMediaAutosavePreferenceLookupUserMessage({
        enabled: false,
        source: "lookup_error",
      })
    ).toBe(
      "Media Library autosave was skipped because your autosave preference could not be verified. You can still save manually."
    );
    expect(
      resolveMediaAutosavePreferenceLookupUserMessage({
        enabled: false,
        source: "stored",
      })
    ).toBeNull();
  });
});
