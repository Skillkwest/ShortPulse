import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import { KIE_VEO_31_FAST_I2V_MODEL_ID } from "../../../lib/model-runtime/providerModelIds";
import {
  getKieStatusBaseUrlsRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  provider: "kie",
  modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
  queueBaseUrl: getKieStatusBaseUrlsRequired(KIE_VEO_31_FAST_I2V_MODEL_ID),
  routeLabel: "Kie Veo 3.1 Fast I2V",
  timeoutMs: getKieTimeoutMsOrDefault(KIE_VEO_31_FAST_I2V_MODEL_ID, 60000),
});
