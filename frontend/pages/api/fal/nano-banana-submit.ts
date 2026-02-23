import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/nano-banana",
  submitUrl: getFalSubmitUrlRequired("fal-ai/nano-banana"),
  routeLabel: "Fal Nano Banana",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/nano-banana"),
});
