/**
 * Proxies Fal FLUX 2 Pro status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URL = "https://queue.fal.run/fal-ai/flux-2-pro/requests";

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URL,
  routeLabel: "Fal FLUX 2 Pro",
  timeoutMs: 60000,
});
