/**
 * Proxies Fal Kling status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URLS = [
  "https://queue.fal.run/fal-ai/kling-video/requests",
  "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video/requests",
];

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URLS,
  routeLabel: "Fal Kling",
  timeoutMs: 60000,
});
