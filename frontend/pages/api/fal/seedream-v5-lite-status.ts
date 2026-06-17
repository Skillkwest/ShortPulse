// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (seedream-v5-lite status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/bytedance/seedream/v5/lite/text-to-image"),
  routeLabel: "Fal Seedream 5 Lite",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedream/v5/lite/text-to-image", 60000),
});
