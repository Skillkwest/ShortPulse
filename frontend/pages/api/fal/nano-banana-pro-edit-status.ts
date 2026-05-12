// Generated compatibility wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (nano-banana-pro-edit status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/nano-banana-pro/edit",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/nano-banana-pro/edit"),
  routeLabel: "Fal Nano Banana Pro Edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana-pro/edit", 60000),
});
