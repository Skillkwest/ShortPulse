import { createFalSubmitHandler } from "../_utils/falSubmitProxy";

const FAL_VEO_SUBMIT_URL = "https://queue.fal.run/fal-ai/veo3.1";

export default createFalSubmitHandler({
  modelId: "fal-ai/veo3.1",
  submitUrl: FAL_VEO_SUBMIT_URL,
  routeLabel: "Fal Veo",
});
