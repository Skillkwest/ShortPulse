// Generated canonical route wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (kie-gpt-image-2 submit).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getKieSubmitUrlRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "kie-ai/gpt-image-2-text-to-image",
  provider: "kie",
  submitUrl: getKieSubmitUrlRequired("kie-ai/gpt-image-2-text-to-image"),
  routeLabel: "Kie GPT Image 2 Text to Image",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/gpt-image-2-text-to-image", 60000),
  validatePayload: validateFalPayloadForModel("kie-ai/gpt-image-2-text-to-image"),
});
