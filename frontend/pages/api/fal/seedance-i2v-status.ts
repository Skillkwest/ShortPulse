/**
 * Proxies Fal Seedance I2V status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/bytedance/seedance/v1.5/pro/image-to-video"),
  routeLabel: "Fal Seedance I2V",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedance/v1.5/pro/image-to-video", 60000),
});
