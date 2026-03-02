/**
 * Seedream edit submit proxy with payload validation.
 * Enforces prompt + 1..10 image references before charging/submitting upstream.
 */
import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import {
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "../../../lib/server/api/falRouteConfig";
import { validateSeedreamEditPayload } from "../../../lib/server/api/seedreamPayloadValidation";

export { validateSeedreamEditPayload };

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedream/v4.5/edit",
  submitUrl: getFalSubmitUrlRequired("fal-ai/bytedance/seedream/v4.5/edit"),
  routeLabel: "Fal Seedream edit",
  timeoutMs: getFalTimeoutMsOrDefault("fal-ai/bytedance/seedream/v4.5/edit", 60000),
  validatePayload: validateSeedreamEditPayload,
});
