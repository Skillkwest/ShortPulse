/**
 * Proxies Fal Nano Banana Pro Edit status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../_utils/falStatusProxy";

const QUEUE_BASE_URL = "https://queue.fal.run/fal-ai/nano-banana-pro/requests";

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URL,
  routeLabel: "Fal Nano Banana Pro Edit",
  timeoutMs: 60000,
});
