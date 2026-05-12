// Generated compatibility wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (kie-veo status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getKieStatusBaseUrlsRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "kie-ai/veo-3.1-fast-i2v",
  provider: "kie",
  queueBaseUrl: getKieStatusBaseUrlsRequired("kie-ai/veo-3.1-fast-i2v"),
  routeLabel: "Kie Veo 3.1 Fast I2V",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/veo-3.1-fast-i2v", 60000),
});
