import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/nano-banana-pro/edit",
  submitUrl: getFalSubmitUrlRequired("fal-ai/nano-banana-pro/edit"),
  routeLabel: "Fal Nano Banana Pro edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana-pro/edit", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/nano-banana-pro/edit"),
});
