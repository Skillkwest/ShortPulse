import { createFalSubmitHandler } from "../_utils/falSubmitProxy";

const FAL_SEEDREAM_EDIT_SUBMIT_URL = "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit";

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedream/v4.5/edit",
  submitUrl: FAL_SEEDREAM_EDIT_SUBMIT_URL,
  routeLabel: "Fal Seedream edit",
  timeoutMs: 60000,
});
