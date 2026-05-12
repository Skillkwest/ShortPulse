// Generated compatibility wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (flux2klein submit).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/flux-2/klein/9b",
  submitUrl: getFalSubmitUrlRequired("fal-ai/flux-2/klein/9b"),
  routeLabel: "Fal FLUX 2 Klein",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/flux-2/klein/9b", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/flux-2/klein/9b"),
});
