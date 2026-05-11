import { createFalStatusHandler } from "../../../lib/server/api/falStatusProxy";
import {
  getKieStatusBaseUrlsRequired,
  getKieTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";

export default createFalStatusHandler({
  modelId: "kie-ai/seedance-2-fast",
  provider: "kie",
  queueBaseUrl: getKieStatusBaseUrlsRequired("kie-ai/seedance-2-fast"),
  routeLabel: "Kie Seedance 2.0 Fast",
  timeoutMs: getKieTimeoutMsOrDefault("kie-ai/seedance-2-fast", 60000),
});
