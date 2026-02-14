/**
 * Proxies Fal FLUX 2 Klein status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URL = "https://queue.fal.run/fal-ai/flux-2/requests";

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URL,
  routeLabel: "Fal FLUX 2 Klein",
  timeoutMs: 60000,
});
