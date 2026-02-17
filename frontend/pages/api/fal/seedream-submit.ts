import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";
import { validateSeedreamImageSizePayload } from "../../../lib/server/api/seedreamPayloadValidation";

const FAL_SEEDREAM_SUBMIT_URL =
  "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image";

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  submitUrl: FAL_SEEDREAM_SUBMIT_URL,
  routeLabel: "Fal Seedream",
  timeoutMs: 60000,
  validatePayload: validateSeedreamImageSizePayload,
});
