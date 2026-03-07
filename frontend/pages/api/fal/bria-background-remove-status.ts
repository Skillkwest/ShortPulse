/**
 * Proxies Fal Bria background-remove status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/bria/background/remove"),
  routeLabel: "Fal Bria background remove",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bria/background/remove", 60000),
});
