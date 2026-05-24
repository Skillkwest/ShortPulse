/**
 * Guards the global Next.js security headers so browser microphone prompts stay
 * available on ShortPulse-owned recording surfaces.
 */
import { describe, expect, it } from "vitest";

describe("next.config security headers", () => {
  it("allows microphone permissions on the app origin", async () => {
    const nextConfigModule = await import("../next.config.js");
    const nextConfig = "default" in nextConfigModule ? nextConfigModule.default : nextConfigModule;
    const headerEntries = await nextConfig.headers();
    const appHeaders = headerEntries.find(
      (entry: { source: string; headers: Array<{ key: string; value: string }> }) =>
        entry.source === "/:path*"
    );

    expect(appHeaders).toBeDefined();

    const permissionsPolicy = appHeaders.headers.find(
      (header: { key: string; value: string }) => header.key === "Permissions-Policy"
    );

    expect(permissionsPolicy).toBeDefined();
    expect(permissionsPolicy.value).toContain("microphone=(self)");
    expect(permissionsPolicy.value).not.toContain("microphone=()");
  });
});
