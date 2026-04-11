import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/bytedance/seedream/v5/lite/edit",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/bytedance/seedream/v5/lite/edit"),
  routeLabel: "Fal Seedream 5 Lite edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedream/v5/lite/edit", 60000),
});
