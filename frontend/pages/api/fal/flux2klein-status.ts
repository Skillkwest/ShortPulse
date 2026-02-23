/**
 * Proxies Fal FLUX 2 Klein status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/flux-2/klein/9b"),
  routeLabel: "Fal FLUX 2 Klein",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/flux-2/klein/9b", 60000),
});
