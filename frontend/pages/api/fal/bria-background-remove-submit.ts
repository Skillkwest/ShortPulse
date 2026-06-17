// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (bria-background-remove submit).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/bria/background/remove",
  submitUrl: getFalSubmitUrlRequired("fal-ai/bria/background/remove"),
  routeLabel: "Fal Bria background remove",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bria/background/remove", 60000),
  validatePayload: validateFalPayloadForModel("fal-ai/bria/background/remove"),
});
