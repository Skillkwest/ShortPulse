import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";

const FAL_NANO_BANANA_PRO_SUBMIT_URL = "https://queue.fal.run/fal-ai/nano-banana-pro";

export default createFalSubmitHandler({
  modelId: "fal-ai/nano-banana-pro",
  submitUrl: FAL_NANO_BANANA_PRO_SUBMIT_URL,
  routeLabel: "Fal Nano Banana Pro",
});
