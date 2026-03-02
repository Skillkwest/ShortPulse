import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import {
  getKieSubmitUrlRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalSubmitHandler({
  modelId: "kie-ai/kling-3.0",
  provider: "kie",
  submitUrl: getKieSubmitUrlRequired("kie-ai/kling-3.0"),
  routeLabel: "Kie Kling 3.0",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/kling-3.0", 20000),
  validatePayload: validateFalPayloadForModel("kie-ai/kling-3.0"),
});
