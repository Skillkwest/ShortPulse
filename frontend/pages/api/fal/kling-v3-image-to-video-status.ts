/**
 * Proxies Fal Kling 3.0 image-to-video status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URL = "https://queue.fal.run/fal-ai/kling-video/requests";

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URL,
  routeLabel: "Fal Kling 3.0 image-to-video",
  timeoutMs: 60000,
});
