/**
 * Proxies Fal FLUX 2 Edit status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal/flux-2/edit"),
  routeLabel: "Fal FLUX 2 Edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal/flux-2/edit", 60000),
});
