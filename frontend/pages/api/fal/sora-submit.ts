import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/sora-2/text-to-video/pro",
  submitUrl: getFalSubmitUrlRequired("fal-ai/sora-2/text-to-video/pro"),
  routeLabel: "Fal Sora",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/sora-2/text-to-video/pro", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/sora-2/text-to-video/pro"),
});
