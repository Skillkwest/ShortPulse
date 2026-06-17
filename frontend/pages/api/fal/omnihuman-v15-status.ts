// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (omnihuman-v15 status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/bytedance/omnihuman/v1.5",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/bytedance/omnihuman/v1.5"),
  routeLabel: "Fal OmniHuman v1.5",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/omnihuman/v1.5", 60000),
});
