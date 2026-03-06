/**
 * Proxies Fal FLUX Pro Fill status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/flux-pro/v1/fill"),
  routeLabel: "Fal FLUX Pro Fill",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/flux-pro/v1/fill", 60000),
});
