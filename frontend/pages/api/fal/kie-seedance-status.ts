// Generated compatibility wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (kie-seedance status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getKieStatusBaseUrlsRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "kie-ai/seedance-1.5-pro",
  provider: "kie",
  queueBaseUrl: getKieStatusBaseUrlsRequired("kie-ai/seedance-1.5-pro"),
  routeLabel: "Kie Seedance 1.5 Pro",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/seedance-1.5-pro", 60000),
});
