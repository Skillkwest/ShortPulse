/**
 * Proxies Fal Nano Banana Edit status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/nano-banana/edit"),
  routeLabel: "Fal Nano Banana Edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana/edit", 60000),
});
