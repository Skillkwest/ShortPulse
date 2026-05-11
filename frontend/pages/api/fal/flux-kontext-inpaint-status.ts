import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getFalStatusBaseUrlsRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "fal-ai/flux-kontext-lora/inpaint",
  queueBaseUrl: getFalStatusBaseUrlsRequired("fal-ai/flux-kontext-lora/inpaint"),
  routeLabel: "Fal FLUX Kontext Inpaint",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/flux-kontext-lora/inpaint", 60000),
});
