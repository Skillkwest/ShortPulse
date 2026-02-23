import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
  submitUrl: getFalSubmitUrlRequired("fal-ai/bytedance/seedance/v1.5/pro/text-to-video"),
  routeLabel: "Fal Seedance",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedance/v1.5/pro/text-to-video", 20000),
  validatePayload: validateFalPayloadForModel("fal-ai/bytedance/seedance/v1.5/pro/text-to-video"),
});
