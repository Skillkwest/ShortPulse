/**
 * Proxies Fal FLUX 2 Pro status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal/flux-2-pro"),
  routeLabel: "Fal FLUX 2 Pro",
  timeoutMs: getFalTimeoutMsOrDefault("fal/flux-2-pro", 60000),
});
