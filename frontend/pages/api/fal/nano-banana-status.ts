/**
 * Proxies Fal Nano Banana status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/nano-banana"),
  routeLabel: "Fal Nano Banana",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana", 60000),
});
