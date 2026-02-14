import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";

const FAL_NANO_BANANA_SUBMIT_URL = "https://queue.fal.run/fal-ai/nano-banana";

export default createFalSubmitHandler({
  modelId: "fal-ai/nano-banana",
  submitUrl: FAL_NANO_BANANA_SUBMIT_URL,
  routeLabel: "Fal Nano Banana",
});
