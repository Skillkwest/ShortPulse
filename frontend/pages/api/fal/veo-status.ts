/**
 * Proxies Fal Veo status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/veo3.1"),
  routeLabel: "Fal Veo",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/veo3.1", 90000),
});
