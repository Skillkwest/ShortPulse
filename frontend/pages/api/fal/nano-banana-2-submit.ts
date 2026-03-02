import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/nano-banana-2",
  submitUrl: getFalSubmitUrlRequired("fal-ai/nano-banana-2"),
  routeLabel: "Fal Nano Banana 2",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana-2", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/nano-banana-2"),
});
