/**
 * Proxies Fal Seedance status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/bytedance/seedance/v1.5/pro/text-to-video"),
  routeLabel: "Fal Seedance",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedance/v1.5/pro/text-to-video", 60000),
});
