/**
 * Proxies Fal Seedance I2V status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URLS = [
  "https://queue.fal.run/fal-ai/bytedance/requests",
  "https://queue.fal.run/fal-ai/bytedance/seedance/requests",
  "https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/image-to-video/requests",
];

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URLS,
  routeLabel: "Fal Seedance I2V",
  timeoutMs: 60000,
});
