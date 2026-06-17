// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (seedream-v5-lite-edit status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/bytedance/seedream/v5/lite/edit",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/bytedance/seedream/v5/lite/edit"),
  routeLabel: "Fal Seedream 5 Lite edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedream/v5/lite/edit", 60000),
});
