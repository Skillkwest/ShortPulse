import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/bria/background/remove",
  skipBilling: true,
  submitUrl: getFalSubmitUrlRequired("fal-ai/bria/background/remove"),
  routeLabel: "Fal Bria background remove",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bria/background/remove", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/bria/background/remove"),
});
