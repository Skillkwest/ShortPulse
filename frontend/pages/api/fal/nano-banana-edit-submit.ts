import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";

const FAL_NANO_BANANA_EDIT_SUBMIT_URL = "https://queue.fal.run/fal-ai/nano-banana/edit";

export default createFalSubmitHandler({
  modelId: "fal-ai/nano-banana/edit",
  submitUrl: FAL_NANO_BANANA_EDIT_SUBMIT_URL,
  routeLabel: "Fal Nano Banana edit",
});
