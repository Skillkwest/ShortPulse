import { beforeEach, describe, expect, it } from "vitest";
import type { Session } from "@supabase/supabase-js";
import {
  clearAuthSessionLogoutEpoch,
  clearLogoutEpochWhenSessionIsFresh,
  isSessionOlderThanLogoutEpoch,
  markAuthSessionLoggedOut,
  readAuthSessionLogoutEpoch,
} from "../authSessionInvalidation";

const encodeBase64Url = (value: string): string =>
  btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const sessionWithIssuedAt = (issuedAtSeconds: number): Session =>
  ({
    access_token: [
      encodeBase64Url(JSON.stringify({ alg: "none" })),
      encodeBase64Url(JSON.stringify({ iat: issuedAtSeconds })),
      "signature",
    ].join("."),
    user: { id: "user-1" },
  }) as Session;

describe("auth session invalidation", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores only a logout epoch marker", () => {
    markAuthSessionLoggedOut(1_000);

    expect(readAuthSessionLogoutEpoch()).toBe(1_000);
    expect(window.localStorage.getItem("shortpulse.auth.logoutEpoch")).toBe("1000");
  });

  it("treats sessions issued before the logout epoch as stale", () => {
    markAuthSessionLoggedOut(2_000);

    expect(isSessionOlderThanLogoutEpoch(sessionWithIssuedAt(1))).toBe(true);
    expect(isSessionOlderThanLogoutEpoch(sessionWithIssuedAt(3))).toBe(false);
  });

  it("does not clear the logout marker for restored old sessions", () => {
    markAuthSessionLoggedOut(2_000);

    clearLogoutEpochWhenSessionIsFresh(sessionWithIssuedAt(1));

    expect(readAuthSessionLogoutEpoch()).toBe(2_000);
  });

  it("clears the logout marker for sessions issued after logout", () => {
    markAuthSessionLoggedOut(2_000);

    clearLogoutEpochWhenSessionIsFresh(sessionWithIssuedAt(3));

    expect(readAuthSessionLogoutEpoch()).toBeNull();
  });

  it("can clear the marker explicitly", () => {
    markAuthSessionLoggedOut(2_000);

    clearAuthSessionLogoutEpoch();

    expect(readAuthSessionLogoutEpoch()).toBeNull();
  });
});
