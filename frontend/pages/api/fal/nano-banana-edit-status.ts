/**
 * Proxies Fal Nano Banana Edit status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URLS = [
  "https://queue.fal.run/fal-ai/nano-banana/requests",
  "https://queue.fal.run/fal-ai/nano-banana/edit/requests",
];

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URLS,
  routeLabel: "Fal Nano Banana Edit",
  timeoutMs: 60000,
});
