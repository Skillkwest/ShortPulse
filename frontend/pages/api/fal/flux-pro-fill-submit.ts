import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/flux-pro/v1/fill",
  submitUrl: getFalSubmitUrlRequired("fal-ai/flux-pro/v1/fill"),
  routeLabel: "Fal FLUX Pro Fill",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/flux-pro/v1/fill", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/flux-pro/v1/fill"),
});
