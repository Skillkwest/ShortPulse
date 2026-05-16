import { describe, expect, it, vi } from "vitest";
import { readMediaAutosaveEnabledForUser } from "../mediaAutosavePreference";

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
    const enabled = await readMediaAutosaveEnabledForUser({
      userId: "user-1",
      supabaseAdmin: buildSupabaseAdmin({ data: null, error: null }) as never,
    });

    expect(enabled).toBe(true);
  });

  it("fails closed when the preference lookup errors", async () => {
    const enabled = await readMediaAutosaveEnabledForUser({
      userId: "user-1",
      supabaseAdmin: buildSupabaseAdmin({
        data: null,
        error: { message: "lookup failed" },
      }) as never,
    });

    expect(enabled).toBe(false);
  });
});
