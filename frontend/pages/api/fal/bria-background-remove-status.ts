// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (bria-background-remove status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/bria/background/remove",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/bria/background/remove"),
  routeLabel: "Fal Bria background remove",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bria/background/remove", 60000),
});
