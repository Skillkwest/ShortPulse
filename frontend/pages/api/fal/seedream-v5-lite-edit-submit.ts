// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (seedream-v5-lite-edit submit).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateSeedreamEditPayload } from "../../../lib/server/api/seedreamPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedream/v5/lite/edit",
  submitUrl: getFalSubmitUrlRequired("fal-ai/bytedance/seedream/v5/lite/edit"),
  routeLabel: "Fal Seedream 5 Lite edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedream/v5/lite/edit", 60000),
  validatePayload: validateSeedreamEditPayload,
});
