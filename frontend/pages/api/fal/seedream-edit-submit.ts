// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (seedream-edit submit).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateSeedreamEditPayload } from "../../../lib/server/api/seedreamPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export { validateSeedreamEditPayload };

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedream/v4.5/edit",
  submitUrl: getFalSubmitUrlRequired("fal-ai/bytedance/seedream/v4.5/edit"),
  routeLabel: "Fal Seedream edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedream/v4.5/edit", 60000),
  validatePayload: validateSeedreamEditPayload,
});
