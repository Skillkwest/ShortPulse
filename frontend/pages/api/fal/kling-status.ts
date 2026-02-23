/**
 * Proxies Fal Kling status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/kling-video/v3/pro/text-to-video"),
  routeLabel: "Fal Kling",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/kling-video/v3/pro/text-to-video", 60000),
});
