import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/veo3.1",
  submitUrl: getFalSubmitUrlRequired("fal-ai/veo3.1"),
  routeLabel: "Fal Veo",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/veo3.1", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/veo3.1"),
});
