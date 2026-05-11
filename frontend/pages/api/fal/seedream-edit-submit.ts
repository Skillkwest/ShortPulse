import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateSeedreamEditPayload } from "../../../lib/server/api/seedreamPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export { validateSeedreamEditPayload };

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedream/v4.5/edit",
  submitUrl: getFalSubmitUrlRequired("fal-ai/bytedance/seedream/v4.5/edit"),
  routeLabel: "Fal Seedream edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedream/v4.5/edit", 60000),
  validatePayload: validateSeedreamEditPayload,
});
