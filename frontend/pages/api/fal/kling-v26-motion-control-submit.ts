import { createFalSubmitHandler } from "../_utils/falSubmitProxy";

const FAL_KLING_MOTION_CONTROL_SUBMIT_URL = "https://queue.fal.run/fal-ai/kling-video/v2.6/pro/motion-control";

export default createFalSubmitHandler({
  modelId: "fal-ai/kling-video/v2.6/pro/motion-control",
  submitUrl: FAL_KLING_MOTION_CONTROL_SUBMIT_URL,
  routeLabel: "Fal Kling 2.6 motion control",
});
