// Generated compatibility wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (kie-kling status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getKieStatusBaseUrlsRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "kie-ai/kling-3.0",
  provider: "kie",
  queueBaseUrl: getKieStatusBaseUrlsRequired("kie-ai/kling-3.0"),
  routeLabel: "Kie Kling 3.0",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/kling-3.0", 60000),
});
