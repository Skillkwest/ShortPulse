import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/nano-banana-pro/edit",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/nano-banana-pro/edit"),
  routeLabel: "Fal Nano Banana Pro Edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana-pro/edit", 60000),
});
