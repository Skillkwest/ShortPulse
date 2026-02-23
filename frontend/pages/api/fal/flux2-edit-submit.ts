import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal/flux-2/edit",
  submitUrl: getFalSubmitUrlRequired("fal/flux-2/edit"),
  routeLabel: "Fal FLUX 2 edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal/flux-2/edit", 20000),
  validatePayload: validateFalPayloadForModel("fal/flux-2/edit"),
});
