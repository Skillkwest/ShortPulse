// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (kie-gpt-image-2-edit status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getKieStatusBaseUrlsRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "kie-ai/gpt-image-2-image-to-image",
  provider: "kie",
  queueBaseUrl: getKieStatusBaseUrlsRequired("kie-ai/gpt-image-2-image-to-image"),
  routeLabel: "Kie GPT Image 2 Image to Image",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/gpt-image-2-image-to-image", 60000),
});
