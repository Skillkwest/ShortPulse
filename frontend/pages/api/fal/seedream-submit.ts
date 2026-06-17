// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (seedream submit).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateSeedreamImageSizePayload } from "../../../lib/server/api/seedreamPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  submitUrl: getFalSubmitUrlRequired("fal-ai/bytedance/seedream/v4.5/text-to-image"),
  routeLabel: "Fal Seedream",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedream/v4.5/text-to-image", 60000),
  validatePayload: validateSeedreamImageSizePayload,
});
