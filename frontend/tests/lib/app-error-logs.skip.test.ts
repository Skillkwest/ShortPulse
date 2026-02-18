import { describe, expect, it } from "vitest";
import { writeAppErrorLog } from "../../lib/server/api/appErrorLogs";

describe("appErrorLogs skip rules", () => {
  it("skips local-development client telemetry", async () => {
    const result = await writeAppErrorLog({
      source: "client.ui_hint",
      scope: "app",
      severity: "medium",
      message: "Sidebar hint is visible.",
      stack: null,
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
      },
    });

    expect(result).toEqual({ ok: true, skipped: true, id: null });
  });

  it("keeps actionable ai studio client telemetry in local development", async () => {
    const result = await writeAppErrorLog({
      source: "client.ai_studio.ui_error_banner",
      scope: "app",
      severity: "medium",
      message: "Upstream error (thinker)",
      route: "/ai-studio",
      stack: null,
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
      },
    });

    expect(result).toEqual({ ok: false, skipped: false, id: null });
  });

  it("keeps high-severity react-refresh reference errors for ai studio", async () => {
    const result = await writeAppErrorLog({
      source: "client.react_error_boundary",
      scope: "app",
      severity: "high",
      message: "renderProperties is not defined",
      route: "/ai-studio",
      stack:
        "ReferenceError: renderProperties is not defined\nat Object.performReactRefresh (webpack:///react-refresh)",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
      },
    });

    expect(result).toEqual({ ok: false, skipped: false, id: null });
  });
});
