/**
 * Proxies Fal Veo 3.1 image-to-video submit requests through the shared submit engine.
 * Uses ordered submit targets to absorb provider alias drift without route-level duplication.
 */
import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateFalPayloadForModel } from "../../../lib/server/api/falPayloadValidation";
import { getFalModelProfileByModelId } from "../../../lib/server/falIntegration/modelProfiles";

const veoI2vProfile = getFalModelProfileByModelId("fal-ai/veo3.1/image-to-video");
if (!veoI2vProfile) {
  throw new Error("Missing Fal model profile for fal-ai/veo3.1/image-to-video");
}

export default createFalSubmitHandler({
  modelId: "fal-ai/veo3.1/image-to-video",
  submitTargets: veoI2vProfile.submitTargets,
  routeLabel: "Fal Veo image-to-video",
  timeoutMs: veoI2vProfile.timeoutMs,
  validatePayload: validateFalPayloadForModel("fal-ai/veo3.1/image-to-video"),
});
