/**
 * Proxies Fal Nano Banana status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URL = "https://queue.fal.run/fal-ai/nano-banana/requests";

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URL,
  routeLabel: "Fal Nano Banana",
  timeoutMs: 60000,
});
