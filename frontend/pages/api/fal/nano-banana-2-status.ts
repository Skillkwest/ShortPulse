/**
 * Proxies Fal Nano Banana 2 status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/nano-banana-2"),
  routeLabel: "Fal Nano Banana 2",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana-2", 60000),
});
