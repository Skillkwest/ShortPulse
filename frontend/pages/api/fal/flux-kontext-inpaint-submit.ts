// Generated compatibility wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (flux-kontext-inpaint submit).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/flux-kontext-lora/inpaint",
  submitUrl: getFalSubmitUrlRequired("fal-ai/flux-kontext-lora/inpaint"),
  routeLabel: "Fal FLUX Kontext Inpaint",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/flux-kontext-lora/inpaint", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/flux-kontext-lora/inpaint"),
});
