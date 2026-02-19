/**
 * Proxies Fal Flux status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URLS = [
  "https://queue.fal.run/fal-ai/flux/requests",
  "https://queue.fal.run/fal-ai/flux/dev/requests",
];

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URLS,
  routeLabel: "Fal Flux",
  timeoutMs: 20000,
});
