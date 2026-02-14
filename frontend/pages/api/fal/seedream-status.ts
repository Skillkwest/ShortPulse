/**
 * Proxies Fal Seedream status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URLS = [
  "https://queue.fal.run/fal-ai/bytedance/requests",
  "https://queue.fal.run/fal-ai/bytedance/seedream/requests",
  "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/requests",
  "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
  "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit/requests",
];

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URLS,
  routeLabel: "Fal Seedream",
  timeoutMs: 60000,
});
