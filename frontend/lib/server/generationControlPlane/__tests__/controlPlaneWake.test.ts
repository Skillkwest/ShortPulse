import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestGenerationControlPlaneWake } from "../controlPlaneWake";

const readFalRuntimeFlagsMock = vi.fn();

vi.mock("../../api/falRuntimeFlags", () => ({
  readFalRuntimeFlags: (...args: unknown[]) => readFalRuntimeFlagsMock(...args),
}));

describe("requestGenerationControlPlaneWake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suppresses wake requests for the internal control-plane route", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    readFalRuntimeFlagsMock.mockReturnValue({
      publicApiBaseUrl: "https://shortpulse.test",
      reconcilerCronSecret: "secret",
    });

    await requestGenerationControlPlaneWake({
      routeLabel: "internal/generation-recovery/run",
      reason: "queued_submit",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a best-effort wake hint when base URL and secret are available", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    readFalRuntimeFlagsMock.mockReturnValue({
      publicApiBaseUrl: "https://shortpulse.test",
      reconcilerCronSecret: "secret",
    });

    await requestGenerationControlPlaneWake({
      routeLabel: "api/fal/submit",
      reason: "queued_submit",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://shortpulse.test/api/internal/generation-recovery/run",
      {
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
          "x-shortpulse-cron-secret": "secret",
        },
        body: JSON.stringify({
          source: "control_plane_wake",
          reason: "queued_submit",
          route_label: "api/fal/submit",
        }),
      }
    );
  });

  it("no-ops when the public base URL or cron secret is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    readFalRuntimeFlagsMock.mockReturnValue({
      publicApiBaseUrl: null,
      reconcilerCronSecret: null,
    });

    await requestGenerationControlPlaneWake({
      routeLabel: "api/fal/submit",
      reason: "queued_submit",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
