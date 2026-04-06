import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import { KIE_SEEDANCE_15_PRO_MODEL_ID } from "../../../lib/model-runtime/providerModelIds";
import {
  getKieStatusBaseUrlsRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  provider: "kie",
  modelId: KIE_SEEDANCE_15_PRO_MODEL_ID,
  queueBaseUrl: getKieStatusBaseUrlsRequired(KIE_SEEDANCE_15_PRO_MODEL_ID),
  routeLabel: "Kie Seedance 1.5 Pro",
  timeoutMs: getKieTimeoutMsOrDefault(KIE_SEEDANCE_15_PRO_MODEL_ID, 60000),
});
