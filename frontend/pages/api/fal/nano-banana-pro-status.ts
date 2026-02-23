/**
 * Proxies Fal Nano Banana Pro status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/nano-banana-pro"),
  routeLabel: "Fal Nano Banana Pro",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana-pro", 60000),
});
