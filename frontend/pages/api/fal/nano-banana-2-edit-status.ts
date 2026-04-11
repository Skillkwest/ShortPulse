/**
 * Proxies Fal Nano Banana 2 Edit status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/nano-banana-2/edit",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/nano-banana-2/edit"),
  routeLabel: "Fal Nano Banana 2 Edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/nano-banana-2/edit", 60000),
});
