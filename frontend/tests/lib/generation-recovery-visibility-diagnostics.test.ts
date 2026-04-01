/**
 * Guardrail tests for recovery visibility diagnostics.
 * Protects the approved diagnostics runner bundle and the SQL/telemetry
 * contract used to measure provider-terminal-to-media-visible latency.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GENERATION_RECOVERY_MEDIA_VISIBLE_EVENT,
  GENERATION_RECOVERY_MEDIA_VISIBLE_TELEMETRY_SOURCE,
} from "../../lib/server/api/errorTelemetryPolicy";

const diagnosticsRunnerPath = path.resolve(
  process.cwd(),
  "..",
  "scripts",
  "reliability_control_plane_diagnostics.sh"
);
const recoveryVisibilitySqlPath = path.resolve(
  process.cwd(),
  "..",
  "sql",
  "check_generation_recovery_media_visible_latency.sql"
);
const recoveryExecutionPath = path.resolve(
  process.cwd(),
  "lib",
  "server",
  "falIntegration",
  "recoveryExecution.ts"
);

const RECOVERY_VISIBILITY_LATENCY_FIELD = "provider_terminal_to_media_visible_ms";
const RECOVERY_VISIBILITY_SQL_FILE = "sql/check_generation_recovery_media_visible_latency.sql";

describe("generation recovery visibility diagnostics", () => {
  it("includes the recovery visibility SQL in the approved diagnostics runner bundle", () => {
    const script = fs.readFileSync(diagnosticsRunnerPath, "utf8");

    expect(script).toContain(`"$ROOT_DIR/${RECOVERY_VISIBILITY_SQL_FILE}"`);
    expect(script).toContain(
      'echo "  - \\`sql/check_generation_recovery_media_visible_latency.sql\\`"'
    );
  });

  it("keeps the recovery visibility SQL aligned with the emitted telemetry source and metric field", () => {
    const sql = fs.readFileSync(recoveryVisibilitySqlPath, "utf8");
    const recoveryExecutionSource = fs.readFileSync(recoveryExecutionPath, "utf8");

    expect(sql).toContain(
      `where e.source = '${GENERATION_RECOVERY_MEDIA_VISIBLE_TELEMETRY_SOURCE}'`
    );
    expect(sql).toContain(RECOVERY_VISIBILITY_LATENCY_FIELD);
    expect(recoveryExecutionSource).toContain(`message: GENERATION_RECOVERY_MEDIA_VISIBLE_EVENT`);
    expect(recoveryExecutionSource).toContain(
      `source: GENERATION_RECOVERY_MEDIA_VISIBLE_TELEMETRY_SOURCE`
    );
    expect(recoveryExecutionSource).toContain(`${RECOVERY_VISIBILITY_LATENCY_FIELD}:`);
    expect(GENERATION_RECOVERY_MEDIA_VISIBLE_EVENT).toBe("media_visible");
  });
});
