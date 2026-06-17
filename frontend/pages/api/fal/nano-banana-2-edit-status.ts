// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (nano-banana-2-edit status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/nano-banana-2/edit",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/nano-banana-2/edit"),
  routeLabel: "Fal Nano Banana 2 Edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana-2/edit", 60000),
});
