// Generated compatibility wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (kie-gpt-image-2-edit submit).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getKieSubmitUrlRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "kie-ai/gpt-image-2-image-to-image",
  provider: "kie",
  submitUrl: getKieSubmitUrlRequired("kie-ai/gpt-image-2-image-to-image"),
  routeLabel: "Kie GPT Image 2 Image to Image",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/gpt-image-2-image-to-image", 60000),
  validatePayload: validateFalPayloadForModel("kie-ai/gpt-image-2-image-to-image"),
});
