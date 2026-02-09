import { createFalSubmitHandler } from "../_utils/falSubmitProxy";

const FAL_KLING_V3_TEXT_SUBMIT_URL = "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video";

export default createFalSubmitHandler({
  modelId: "fal-ai/kling-video/v3/pro/text-to-video",
  submitUrl: FAL_KLING_V3_TEXT_SUBMIT_URL,
  routeLabel: "Fal Kling 3.0 text",
});
