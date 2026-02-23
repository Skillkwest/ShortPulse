import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal/flux-2",
  submitUrl: getFalSubmitUrlRequired("fal/flux-2"),
  routeLabel: "Fal FLUX 2",
  timeoutMs: getFalTimeoutMsOrDefault("fal/flux-2", 20000),
  validatePayload: validateFalPayloadForModel("fal/flux-2"),
});
