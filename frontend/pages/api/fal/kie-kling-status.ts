import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import { KIE_KLING_30_MODEL_ID } from "../../../lib/model-runtime/providerModelIds";
import {
  getKieStatusBaseUrlsRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  provider: "kie",
  modelId: KIE_KLING_30_MODEL_ID,
  queueBaseUrl: getKieStatusBaseUrlsRequired(KIE_KLING_30_MODEL_ID),
  routeLabel: "Kie Kling 3.0",
  timeoutMs: getKieTimeoutMsOrDefault(KIE_KLING_30_MODEL_ID, 60000),
});
