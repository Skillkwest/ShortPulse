import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import { KIE_SEEDANCE_15_PRO_MODEL_ID } from "../../../lib/model-runtime/providerModelIds";
import {
  getKieSubmitUrlRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: KIE_SEEDANCE_15_PRO_MODEL_ID,
  provider: "kie",
  submitUrl: getKieSubmitUrlRequired(KIE_SEEDANCE_15_PRO_MODEL_ID),
  routeLabel: "Kie Seedance 1.5 Pro",
  timeoutMs: getKieTimeoutMsOrDefault(KIE_SEEDANCE_15_PRO_MODEL_ID, 20000),
  validatePayload: validateFalPayloadForModel(KIE_SEEDANCE_15_PRO_MODEL_ID),
});
