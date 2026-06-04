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

  it("keeps ai studio UI mirror telemetry out of grouped incidents", async () => {
    const result = await writeAppErrorLog({
      source: "telemetry.ai_studio.ui_error_banner",
      scope: "app",
      severity: "low",
      message: "Upstream error (thinker)",
      route: "/ai-studio",
      stack: null,
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
      },
    });

    expect(result).toEqual({ ok: true, skipped: false, id: null });
  });

  it("skips hidden-tab local workspace fetch noise", async () => {
    const result = await writeAppErrorLog({
      source: "client.api_network",
      scope: "app",
      severity: "high",
      message: "Failed to fetch",
      route: "/ai-studio",
      endpoint: "/api/projects/project-1/workspace",
      stack: "TypeError: Failed to fetch\n    at executeRequest",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
        visibility_state: "hidden",
      },
    });

    expect(result).toEqual({ ok: true, skipped: true, id: null });
  });

  it("keeps visible local workspace fetch failures actionable", async () => {
    const result = await writeAppErrorLog({
      source: "client.api_network",
      scope: "app",
      severity: "high",
      message: "Failed to fetch",
      route: "/ai-studio",
      endpoint: "/api/projects/project-1/workspace",
      stack: "TypeError: Failed to fetch\n    at executeRequest",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
        visibility_state: "visible",
      },
    });

    expect(result).toEqual({ ok: false, skipped: false, id: null });
  });

  it("skips hidden-tab local project identity fetch noise", async () => {
    const result = await writeAppErrorLog({
      source: "client.api_network",
      scope: "app",
      severity: "high",
      message: "Failed to fetch",
      route: "/ai-studio",
      endpoint: "/api/projects/4518af3f-b8b2-4c2c-95ed-4251d7218408",
      stack: "TypeError: Failed to fetch\n    at executeRequest",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
        visibility_state: "hidden",
      },
    });

    expect(result).toEqual({ ok: true, skipped: true, id: null });
  });

  it("keeps visible local project identity fetch failures actionable", async () => {
    const result = await writeAppErrorLog({
      source: "client.api_network",
      scope: "app",
      severity: "high",
      message: "Failed to fetch",
      route: "/ai-studio",
      endpoint: "/api/projects/4518af3f-b8b2-4c2c-95ed-4251d7218408",
      stack: "TypeError: Failed to fetch\n    at executeRequest",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
        visibility_state: "visible",
      },
    });

    expect(result).toEqual({ ok: false, skipped: false, id: null });
  });

  it("skips hidden-tab local admin errors refresh fetch noise", async () => {
    const result = await writeAppErrorLog({
      source: "client.api_network",
      scope: "app",
      severity: "high",
      message: "Failed to fetch",
      route: "/admin/kanban",
      endpoint: "/api/admin/errors?page=1&limit=50&status=open",
      stack: "TypeError: Failed to fetch\n    at executeRequest",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
        visibility_state: "hidden",
      },
    });

    expect(result).toEqual({ ok: true, skipped: true, id: null });
  });

  it("keeps visible local admin errors refresh failures actionable", async () => {
    const result = await writeAppErrorLog({
      source: "client.api_network",
      scope: "app",
      severity: "high",
      message: "Failed to fetch",
      route: "/admin/errors",
      endpoint: "/api/admin/errors?page=1&limit=50&status=open",
      stack: "TypeError: Failed to fetch\n    at executeRequest",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
        visibility_state: "visible",
      },
    });

    expect(result).toEqual({ ok: false, skipped: false, id: null });
  });

  it("skips hidden-tab local admin billing diagnostics fetch noise", async () => {
    const result = await writeAppErrorLog({
      source: "client.api_network",
      scope: "app",
      severity: "high",
      message: "Failed to fetch",
      route: "/admin/errors",
      endpoint: "/api/admin/billing-diagnostics?userId=user-1",
      stack: "TypeError: Failed to fetch\n    at executeRequest",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
        visibility_state: "hidden",
      },
    });

    expect(result).toEqual({ ok: true, skipped: true, id: null });
  });

  it("keeps visible local admin billing diagnostics fetch failures actionable", async () => {
    const result = await writeAppErrorLog({
      source: "client.api_network",
      scope: "app",
      severity: "high",
      message: "Failed to fetch",
      route: "/admin/errors",
      endpoint: "/api/admin/billing-diagnostics?userId=user-1",
      stack: "TypeError: Failed to fetch\n    at executeRequest",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
        visibility_state: "visible",
      },
    });

    expect(result).toEqual({ ok: false, skipped: false, id: null });
  });

  it("skips hidden-tab local media compliance fetch noise", async () => {
    const result = await writeAppErrorLog({
      source: "client.api_network",
      scope: "app",
      severity: "high",
      message: "Failed to fetch",
      route: "/ai-studio",
      endpoint: "/api/account/media-compliance",
      stack: "TypeError: Failed to fetch\n    at executeRequest",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
        visibility_state: "hidden",
      },
    });

    expect(result).toEqual({ ok: true, skipped: true, id: null });
  });

  it("keeps visible local media compliance fetch failures actionable", async () => {
    const result = await writeAppErrorLog({
      source: "client.api_network",
      scope: "app",
      severity: "high",
      message: "Failed to fetch",
      route: "/ai-studio",
      endpoint: "/api/account/media-compliance",
      stack: "TypeError: Failed to fetch\n    at executeRequest",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
        visibility_state: "visible",
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

  it("skips local non-ai-studio react-refresh reference misses", async () => {
    const result = await writeAppErrorLog({
      source: "client.runtime",
      scope: "app",
      severity: "high",
      message: "PricingCatalogSections is not defined",
      route: "/admin/pricing",
      stack:
        "ReferenceError: PricingCatalogSections is not defined\nat Object.performReactRefresh (webpack:///react-refresh)\nat applyUpdate",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
        visibility_state: "visible",
      },
    });

    expect(result).toEqual({ ok: true, skipped: true, id: null });
  });

  it("keeps generation react-refresh reference misses actionable", async () => {
    const result = await writeAppErrorLog({
      source: "client.runtime",
      scope: "generation",
      severity: "high",
      message: "pollGenerationStatus is not defined",
      route: "/admin/pricing",
      stack:
        "ReferenceError: pollGenerationStatus is not defined\nat Object.performReactRefresh (webpack:///react-refresh)\nat applyUpdate",
      metadata: {
        host: "localhost:3000",
        client_environment: "development",
        visibility_state: "visible",
      },
    });

    expect(result).toEqual({ ok: false, skipped: false, id: null });
  });

  it("skips browser ResizeObserver loop notifications", async () => {
    const result = await writeAppErrorLog({
      source: "client.runtime",
      scope: "app",
      severity: "high",
      message: "ResizeObserver loop completed with undelivered notifications.",
      route: "/ai-studio",
      stack: null,
      metadata: {
        host: "shortpulse.example",
        client_environment: "production",
      },
    });

    expect(result).toEqual({ ok: true, skipped: true, id: null });
  });

  it("keeps generation telemetry even when the status code is non-error", async () => {
    const result = await writeAppErrorLog({
      source: "telemetry.queue.dispatch.submitted",
      scope: "generation",
      severity: "low",
      message: "Queued generation submit dispatched.",
      statusCode: 200,
      metadata: {
        source_ref: "source-1",
        generation_id: "gen-1",
      },
    });

    expect(result).toEqual({ ok: true, skipped: false, id: null });
  });
});
