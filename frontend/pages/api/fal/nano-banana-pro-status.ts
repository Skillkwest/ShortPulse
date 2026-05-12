// Generated compatibility wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (nano-banana-pro status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/nano-banana-pro",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/nano-banana-pro"),
  routeLabel: "Fal Nano Banana Pro",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana-pro", 60000),
});
