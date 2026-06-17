// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (kie-seedance-2 status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getKieStatusBaseUrlsRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "kie-ai/seedance-2",
  provider: "kie",
  queueBaseUrl: getKieStatusBaseUrlsRequired("kie-ai/seedance-2"),
  routeLabel: "Kie Seedance 2.0",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/seedance-2", 60000),
});
