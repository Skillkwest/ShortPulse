import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/kling-video/v3/pro/image-to-video",
  submitUrl: getFalSubmitUrlRequired("fal-ai/kling-video/v3/pro/image-to-video"),
  routeLabel: "Fal Kling 3.0 image",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/kling-video/v3/pro/image-to-video", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/kling-video/v3/pro/image-to-video"),
});
