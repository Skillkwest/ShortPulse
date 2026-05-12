// Generated compatibility wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (flux-kontext-inpaint status).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/flux-kontext-lora/inpaint",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/flux-kontext-lora/inpaint"),
  routeLabel: "Fal FLUX Kontext Inpaint",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/flux-kontext-lora/inpaint", 60000),
});
