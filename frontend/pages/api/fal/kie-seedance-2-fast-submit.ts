// Generated compatibility wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (kie-seedance-2-fast submit).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getKieSubmitUrlRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "kie-ai/seedance-2-fast",
  provider: "kie",
  submitUrl: getKieSubmitUrlRequired("kie-ai/seedance-2-fast"),
  routeLabel: "Kie Seedance 2.0 Fast",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/seedance-2-fast", 60000),
  validatePayload: validateFalPayloadForModel("kie-ai/seedance-2-fast"),
});
