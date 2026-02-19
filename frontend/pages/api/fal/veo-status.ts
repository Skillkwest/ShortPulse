/**
 * Proxies Fal Veo status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URLS = [
  "https://queue.fal.run/fal-ai/veo3.1/requests",
  "https://queue.fal.run/fal-ai/veo3.1/first-last-frame-to-video/requests",
  "https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests",
];

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URLS,
  routeLabel: "Fal Veo",
  timeoutMs: 90000,
});
