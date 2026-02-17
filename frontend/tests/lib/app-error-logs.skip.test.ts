import { describe, expect, it } from "vitest";
import { writeAppErrorLog } from "../../lib/server/api/appErrorLogs";

describe("appErrorLogs skip rules", () => {
  it("skips local-development client telemetry", async () => {
    const result = await writeAppErrorLog({
      source: "client.runtime",
      scope: "app",
      severity: "high",
      message: "mode is not defined",
      stack: "ReferenceError: mode is not defined",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
      },
    });

    expect(result).toEqual({ ok: true, skipped: true, id: null });
  });

  it("skips react-refresh reference errors in development telemetry", async () => {
    const result = await writeAppErrorLog({
      source: "client.react_error_boundary",
      scope: "app",
      severity: "high",
      message: "mode is not defined",
      stack:
        "ReferenceError: mode is not defined\nat Object.performReactRefresh (webpack:///react-refresh)",
      metadata: {
        client_environment: "development",
      },
    });

    expect(result).toEqual({ ok: true, skipped: true, id: null });
  });
});
