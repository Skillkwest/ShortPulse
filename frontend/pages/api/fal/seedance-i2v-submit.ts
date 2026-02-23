import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
  submitUrl: getFalSubmitUrlRequired("fal-ai/bytedance/seedance/v1.5/pro/image-to-video"),
  routeLabel: "Fal Seedance I2V",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedance/v1.5/pro/image-to-video", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/bytedance/seedance/v1.5/pro/image-to-video"),
});
