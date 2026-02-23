/**
 * Proxies Fal FLUX 2 Pro Edit status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal/flux-2-pro/edit"),
  routeLabel: "Fal FLUX 2 Pro Edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal/flux-2-pro/edit", 60000),
});
