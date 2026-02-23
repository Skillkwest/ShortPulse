/**
 * Proxies Fal Sora status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/sora-2/text-to-video/pro"),
  routeLabel: "Fal Sora",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/sora-2/text-to-video/pro", 60000),
});
