import { createFalSubmitHandler } from "../_utils/falSubmitProxy";

const FAL_NANO_BANANA_PRO_EDIT_SUBMIT_URL = "https://queue.fal.run/fal-ai/nano-banana-pro/edit";

export default createFalSubmitHandler({
  modelId: "fal-ai/nano-banana-pro/edit",
  submitUrl: FAL_NANO_BANANA_PRO_EDIT_SUBMIT_URL,
  routeLabel: "Fal Nano Banana Pro edit",
});
