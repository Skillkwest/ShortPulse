/**
 * Guardrail tests for the production trace helper's credential input contract.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const traceScriptPath = path.resolve(
  process.cwd(),
  "..",
  "scripts",
  "capture_ai_studio_production_trace.mjs"
);

describe("capture_ai_studio_production_trace.mjs", () => {
  it("keeps password input out of CLI arguments", () => {
    const result = spawnSync(process.execPath, [traceScriptPath, "--help"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PLAYWRIGHT_AUDIT_EMAIL: "",
        PLAYWRIGHT_AUDIT_PASSWORD: "",
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("--password");
    expect(result.stdout).toContain("PLAYWRIGHT_AUDIT_PASSWORD");
  });

  it("rejects the legacy password CLI option", () => {
    const result = spawnSync(
      process.execPath,
      [traceScriptPath, "--password", "should-not-be-accepted"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          PLAYWRIGHT_AUDIT_EMAIL: "",
          PLAYWRIGHT_AUDIT_PASSWORD: "",
        },
      }
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unknown option: --password");
    expect(result.stdout).not.toContain("should-not-be-accepted");
    expect(result.stderr).not.toContain("should-not-be-accepted");
  });
});
