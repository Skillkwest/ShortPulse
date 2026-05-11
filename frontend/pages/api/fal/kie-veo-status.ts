import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getKieStatusBaseUrlsRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "kie-ai/veo-3.1-fast-i2v",
  provider: "kie",
  queueBaseUrl: getKieStatusBaseUrlsRequired("kie-ai/veo-3.1-fast-i2v"),
  routeLabel: "Kie Veo 3.1 Fast I2V",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/veo-3.1-fast-i2v", 60000),
});
