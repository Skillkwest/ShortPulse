import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/flux-2/klein/9b",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/flux-2/klein/9b"),
  routeLabel: "Fal FLUX 2 Klein",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/flux-2/klein/9b", 60000),
});
