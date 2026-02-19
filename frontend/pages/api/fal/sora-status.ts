/**
 * Proxies Fal Sora status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URLS = [
  "https://queue.fal.run/fal-ai/sora-2/requests",
  "https://queue.fal.run/fal-ai/sora-2/text-to-video/pro/requests",
];

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URLS,
  routeLabel: "Fal Sora",
  timeoutMs: 60000,
});
