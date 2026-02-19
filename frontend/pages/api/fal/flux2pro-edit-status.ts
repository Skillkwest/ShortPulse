/**
 * Proxies Fal FLUX 2 Pro Edit status + result fetch.
 * Accepts { requestId }, returns normalized status payloads.
 */
import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";

const QUEUE_BASE_URLS = [
  "https://queue.fal.run/fal-ai/flux-2-pro/requests",
  "https://queue.fal.run/fal-ai/flux-2-pro/edit/requests",
];

export default createFalStatusHandler({
  queueBaseUrl: QUEUE_BASE_URLS,
  routeLabel: "Fal FLUX 2 Pro Edit",
  timeoutMs: 60000,
});
