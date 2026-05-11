import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getKieStatusBaseUrlsRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "kie-ai/seedance-1.5-pro",
  provider: "kie",
  queueBaseUrl: getKieStatusBaseUrlsRequired("kie-ai/seedance-1.5-pro"),
  routeLabel: "Kie Seedance 1.5 Pro",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/seedance-1.5-pro", 60000),
});
