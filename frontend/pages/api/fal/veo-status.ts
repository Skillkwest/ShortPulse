/**
 * Proxies Fal Veo status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../_utils/falStatusProxy";

const QUEUE_BASE_URL = "https://queue.fal.run/fal-ai/veo3.1/requests";

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URL,
  routeLabel: "Fal Veo",
  timeoutMs: 90000,
});
