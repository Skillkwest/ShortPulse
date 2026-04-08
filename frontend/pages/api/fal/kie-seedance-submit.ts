import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getKieSubmitUrlRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "kie-ai/seedance-1.5-pro",
  provider: "kie",
  submitUrl: getKieSubmitUrlRequired("kie-ai/seedance-1.5-pro"),
  routeLabel: "Kie Seedance 1.5 Pro",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/seedance-1.5-pro", 20000),
  validatePayload: validateFalPayloadForModel("kie-ai/seedance-1.5-pro"),
});
