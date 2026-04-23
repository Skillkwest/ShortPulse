/**
 * Proxies legacy Fal status fetch through the current default image model.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/bytedance/seedream/v4.5/text-to-image"),
  routeLabel: "Fal status legacy",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedream/v4.5/text-to-image", 60000),
});
