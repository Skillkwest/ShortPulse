/**
 * Proxies Fal Kling 3.0 image-to-video status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/kling-video/v3/pro/image-to-video"),
  routeLabel: "Fal Kling 3.0 image-to-video",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/kling-video/v3/pro/image-to-video", 60000),
});
