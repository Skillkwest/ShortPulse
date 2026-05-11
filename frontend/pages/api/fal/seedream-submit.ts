import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateSeedreamImageSizePayload } from "../../../lib/server/api/seedreamPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  submitUrl: getFalSubmitUrlRequired("fal-ai/bytedance/seedream/v4.5/text-to-image"),
  routeLabel: "Fal Seedream",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedream/v4.5/text-to-image", 60000),
  validatePayload: validateSeedreamImageSizePayload,
});
