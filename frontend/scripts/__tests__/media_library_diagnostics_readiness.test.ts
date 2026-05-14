import { describe, expect, it } from "vitest";
import {
  buildReadinessModel,
  parseArgs,
  renderMarkdown,
  resolveFirstEnvValue,
} from "../media_library_diagnostics_readiness.mjs";

const localDetector = () => ({
  frontendPackageJsonPresent: true,
  linkedProjectRef: "abcd1234",
  linkedProjectName: "shortpulse-staging",
  linkedProjectOrg: "shortpulse",
  linkedProjectConfigured: true,
  sqlDiagnosticsPresent: true,
});

const toolingDetector = () => ({
  supabaseCliAvailable: true,
  supabaseVersion: "2.78.1",
  psqlAvailable: false,
  linkedInspectCallsOk: true,
  linkedInspectCallsError: "",
});

describe("media_library_diagnostics_readiness", () => {
  it("parses args with defaults", () => {
    expect(parseArgs([])).toMatchObject({
      help: false,
      writeFile: true,
      jsonStdout: false,
    });
  });

  it("resolves the first present env value", () => {
    expect(
      resolveFirstEnvValue(["ONE", "TWO"], {
        NODE_ENV: "test",
        ONE: "",
        TWO: "value-2",
      })
    ).toEqual({
      key: "TWO",
      value: "value-2",
    });
  });

  it("builds a ready live-probe model when env inputs exist", () => {
    const model = buildReadinessModel({
      env: {
        NODE_ENV: "test",
        SHORTPULSE_STAGING_BASE_URL: "https://staging.example.com",
        SHORTPULSE_MEDIA_LIBRARY_BEARER_TOKEN: "token-123",
      },
      localDetector,
      toolingDetector,
    });

    expect(model.liveProbe.ready).toBe(true);
    expect(model.linkedDb.inspectCallsHealthy).toBe(true);
    expect(model.blockers).toContain(
      "psql is not installed, so raw SQL diagnostics are not directly runnable."
    );
  });

  it("renders a readable markdown summary", () => {
    const markdown = renderMarkdown(
      buildReadinessModel({
        env: {
          NODE_ENV: "test",
          SHORTPULSE_STAGING_BASE_URL: "https://staging.example.com",
          SHORTPULSE_MEDIA_LIBRARY_BEARER_TOKEN: "token-123",
        },
        localDetector,
        toolingDetector,
      })
    );

    expect(markdown).toContain("# Media Library Diagnostics Readiness");
    expect(markdown).toContain("Live app phase0 probe: ready");
    expect(markdown).toContain("Linked Supabase inspect: ready");
  });
});
