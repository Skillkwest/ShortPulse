import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal/flux-2-pro",
  submitUrl: getFalSubmitUrlRequired("fal/flux-2-pro"),
  routeLabel: "Fal FLUX 2 PRO",
  timeoutMs: getFalTimeoutMsOrDefault("fal/flux-2-pro", 20000),
  validatePayload: validateFalPayloadForModel("fal/flux-2-pro"),
});
