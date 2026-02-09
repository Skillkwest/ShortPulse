import { createFalSubmitHandler } from "../_utils/falSubmitProxy";

const FAL_VEO_FIRST_LAST_SUBMIT_URL = "https://queue.fal.run/fal-ai/veo3.1/first-last-frame-to-video";

export default createFalSubmitHandler({
  modelId: "fal-ai/veo3.1/first-last-frame-to-video",
  submitUrl: FAL_VEO_FIRST_LAST_SUBMIT_URL,
  routeLabel: "Fal Veo first/last frame",
});
