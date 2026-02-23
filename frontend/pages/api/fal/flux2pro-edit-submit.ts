import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal/flux-2-pro/edit",
  submitUrl: getFalSubmitUrlRequired("fal/flux-2-pro/edit"),
  routeLabel: "Fal FLUX 2 PRO edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal/flux-2-pro/edit", 20000),
  validatePayload: validateFalPayloadForModel("fal/flux-2-pro/edit"),
});
