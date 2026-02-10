/**
 * Proxies Fal Flux status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../_utils/falStatusProxy";

const QUEUE_BASE_URL = "https://queue.fal.run/fal-ai/flux/requests";

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URL,
  routeLabel: "Fal Flux",
  timeoutMs: 20000,
});
