/**
 * Proxies Fal Veo 3.1 image-to-video submit requests through the shared submit engine.
 * Uses ordered submit targets to absorb provider alias drift without route-level duplication.
 */
import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { falModelProfiles } from "../../../lib/server/falIntegration/modelProfiles";

export default createFalSubmitHandler({
  modelId: "fal-ai/veo3.1/image-to-video",
  submitTargets: falModelProfiles.veoImageToVideo.submitTargets,
  routeLabel: "Fal Veo image-to-video",
  timeoutMs: 20000,
});
