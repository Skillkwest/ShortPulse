import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getKieStatusBaseUrlsRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "kie-ai/kling-3.0",
  provider: "kie",
  queueBaseUrl: getKieStatusBaseUrlsRequired("kie-ai/kling-3.0"),
  routeLabel: "Kie Kling 3.0",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/kling-3.0", 60000),
});
