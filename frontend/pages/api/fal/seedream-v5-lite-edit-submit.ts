import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";
import { validateSeedreamEditPayload } from "../../../lib/server/api/seedreamPayloadValidation";

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedream/v5/lite/edit",
  submitUrl: getFalSubmitUrlRequired("fal-ai/bytedance/seedream/v5/lite/edit"),
  routeLabel: "Fal Seedream 5 Lite edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedream/v5/lite/edit", 60000),
  validatePayload: validateSeedreamEditPayload,
});
