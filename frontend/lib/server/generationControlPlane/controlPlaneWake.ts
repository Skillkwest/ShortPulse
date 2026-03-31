import { readFalRuntimeFlags } from "../api/falRuntimeFlags";

const CONTROL_PLANE_WAKE_ROUTE_PATH = "/api/internal/generation-recovery/run";

const shouldSuppressWake = (routeLabel: string): boolean =>
  routeLabel === "internal/generation-recovery/run" ||
  routeLabel === "worker/generation-control-plane";

export const requestGenerationControlPlaneWake = async ({
  routeLabel,
  reason,
}: {
  routeLabel: string;
  reason: string;
}): Promise<void> => {
  if (shouldSuppressWake(routeLabel)) return;

  const flags = readFalRuntimeFlags();
  const baseUrl = flags.publicApiBaseUrl;
  const secret = flags.reconcilerCronSecret;
  if (!baseUrl || !secret) return;

  try {
    const wakeUrl = new URL(CONTROL_PLANE_WAKE_ROUTE_PATH, baseUrl).toString();
    await fetch(wakeUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
        "x-shortpulse-cron-secret": secret,
      },
      body: JSON.stringify({
        source: "control_plane_wake",
        reason,
        route_label: routeLabel,
      }),
    });
  } catch {
    // Best-effort wake hint only; periodic scheduler and recovery remain authoritative.
  }
};
