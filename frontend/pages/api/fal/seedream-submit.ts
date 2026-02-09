import { createFalSubmitHandler } from "../_utils/falSubmitProxy";

const FAL_SEEDREAM_SUBMIT_URL = "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image";

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  submitUrl: FAL_SEEDREAM_SUBMIT_URL,
  routeLabel: "Fal Seedream",
  timeoutMs: 60000,
});
