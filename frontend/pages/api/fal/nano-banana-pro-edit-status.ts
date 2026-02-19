/**
 * Proxies Fal Nano Banana Pro Edit status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URLS = [
  "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
  "https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests",
];

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URLS,
  routeLabel: "Fal Nano Banana Pro Edit",
  timeoutMs: 60000,
});
