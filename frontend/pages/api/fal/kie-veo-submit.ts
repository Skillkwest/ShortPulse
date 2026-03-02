import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getKieSubmitUrlRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "kie-ai/veo-3.1-fast-i2v",
  provider: "kie",
  submitUrl: getKieSubmitUrlRequired("kie-ai/veo-3.1-fast-i2v"),
  routeLabel: "Kie Veo 3.1 Fast I2V",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/veo-3.1-fast-i2v", 20000),
  validatePayload: validateFalPayloadForModel("kie-ai/veo-3.1-fast-i2v"),
});
