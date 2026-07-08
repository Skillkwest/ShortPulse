/**
 * Guards the global Next.js security headers so browser camera/microphone prompts stay
 * available on ShortPulse-owned recording surfaces.
 */
import { describe, expect, it } from "vitest";

describe("next.config security headers", () => {
  it("includes the bundled FFmpeg runtime in API route traces", async () => {
    const nextConfigModule = await import("../next.config.js");
    const nextConfig = "default" in nextConfigModule ? nextConfigModule.default : nextConfigModule;

    expect(nextConfig.outputFileTracingIncludes).toMatchObject({
      "/api/**/*": expect.arrayContaining(["node_modules/ffmpeg-static/ffmpeg"]),
    });
  });

  it("allows camera and microphone permissions on the app origin", async () => {
    const nextConfigModule = await import("../next.config.js");
    const nextConfig = "default" in nextConfigModule ? nextConfigModule.default : nextConfigModule;
    const headerEntries = await nextConfig.headers();
    const appHeaders = headerEntries.find(
      (entry: { source: string; headers: Array<{ key: string; value: string }> }) =>
        entry.source === "/:path*"
    );

    expect(appHeaders).toBeDefined();
    if (!appHeaders) {
      throw new Error("Expected app security headers entry.");
    }

    const permissionsPolicy = appHeaders.headers.find(
      (header: { key: string; value: string }) => header.key === "Permissions-Policy"
    );

    expect(permissionsPolicy).toBeDefined();
    if (!permissionsPolicy) {
      throw new Error("Expected Permissions-Policy header.");
    }
    expect(permissionsPolicy.value).toContain("camera=(self)");
    expect(permissionsPolicy.value).not.toContain("camera=()");
    expect(permissionsPolicy.value).toContain("microphone=(self)");
    expect(permissionsPolicy.value).not.toContain("microphone=()");
  });

  it("allows the dashboard tutorial YouTube player frame", async () => {
    const nextConfigModule = await import("../next.config.js");
    const nextConfig = "default" in nextConfigModule ? nextConfigModule.default : nextConfigModule;
    const headerEntries = await nextConfig.headers();
    const appHeaders = headerEntries.find(
      (entry: { source: string; headers: Array<{ key: string; value: string }> }) =>
        entry.source === "/:path*"
    );

    expect(appHeaders).toBeDefined();
    if (!appHeaders) {
      throw new Error("Expected app security headers entry.");
    }

    const contentSecurityPolicy = appHeaders.headers.find(
      (header: { key: string; value: string }) => header.key === "Content-Security-Policy"
    );

    expect(contentSecurityPolicy).toBeDefined();
    if (!contentSecurityPolicy) {
      throw new Error("Expected Content-Security-Policy header.");
    }
    expect(contentSecurityPolicy.value).toContain(
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com"
    );
  });

  it("allows local blob and data URL reads for browser-side media staging", async () => {
    const nextConfigModule = await import("../next.config.js");
    const nextConfig = "default" in nextConfigModule ? nextConfigModule.default : nextConfigModule;
    const headerEntries = await nextConfig.headers();
    const appHeaders = headerEntries.find(
      (entry: { source: string; headers: Array<{ key: string; value: string }> }) =>
        entry.source === "/:path*"
    );
    const contentSecurityPolicy = appHeaders?.headers.find(
      (header: { key: string; value: string }) => header.key === "Content-Security-Policy"
    );

    expect(contentSecurityPolicy?.value).toContain("connect-src 'self' https: wss: blob: data:");
  });

  it("registers the Chrome crash Reporting API endpoint", async () => {
    const nextConfigModule = await import("../next.config.js");
    const nextConfig = "default" in nextConfigModule ? nextConfigModule.default : nextConfigModule;
    const headerEntries = await nextConfig.headers();
    const appHeaders = headerEntries.find(
      (entry: { source: string; headers: Array<{ key: string; value: string }> }) =>
        entry.source === "/:path*"
    );
    const reportingEndpoints = appHeaders?.headers.find(
      (header: { key: string; value: string }) => header.key === "Reporting-Endpoints"
    );

    expect(reportingEndpoints?.value).toBe(
      'crash-reporting="https://www.shortpulse.ai/api/browser-crash-report"'
    );
  });

  it("keeps dashboard gallery assets from becoming standalone browser pages", async () => {
    const nextConfigModule = await import("../next.config.js");
    const nextConfig = "default" in nextConfigModule ? nextConfigModule.default : nextConfigModule;
    const headerEntries = await nextConfig.headers();
    const galleryHeaders = headerEntries.find(
      (entry: { source: string; headers: Array<{ key: string; value: string }> }) =>
        entry.source === "/dashboard/gallery/:path*"
    );
    const contentDisposition = galleryHeaders?.headers.find(
      (header: { key: string; value: string }) => header.key === "Content-Disposition"
    );

    expect(contentDisposition?.value).toBe("attachment");
  });
});
