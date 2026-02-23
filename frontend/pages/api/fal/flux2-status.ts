/**
 * Proxies Fal FLUX 2 status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal/flux-2"),
  routeLabel: "Fal FLUX 2",
  timeoutMs: getFalTimeoutMsOrDefault("fal/flux-2", 60000),
});
