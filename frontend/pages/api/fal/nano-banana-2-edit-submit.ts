// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (nano-banana-2-edit submit).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/nano-banana-2/edit",
  submitUrl: getFalSubmitUrlRequired("fal-ai/nano-banana-2/edit"),
  routeLabel: "Fal Nano Banana 2 Edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana-2/edit", 60000),
  validatePayload: validateFalPayloadForModel("fal-ai/nano-banana-2/edit"),
});
