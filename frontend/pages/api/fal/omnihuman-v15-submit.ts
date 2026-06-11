// Generated compatibility wrapper. Do not hand edit.
// Source of truth: scripts/lib/fal_route_inventory.js (omnihuman-v15 submit).
// Regenerate with: npm -C frontend run fal:routes:sync

import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/omnihuman/v1.5",
  submitUrl: getFalSubmitUrlRequired("fal-ai/bytedance/omnihuman/v1.5"),
  routeLabel: "Fal OmniHuman v1.5",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/omnihuman/v1.5", 60000),
  validatePayload: validateFalPayloadForModel("fal-ai/bytedance/omnihuman/v1.5"),
});
