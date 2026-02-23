import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/nano-banana-pro",
  submitUrl: getFalSubmitUrlRequired("fal-ai/nano-banana-pro"),
  routeLabel: "Fal Nano Banana Pro",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana-pro", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/nano-banana-pro"),
});
