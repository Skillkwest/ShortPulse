import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";

const FAL_SEEDANCE_I2V_SUBMIT_URL =
  "https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/image-to-video";

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
  submitUrl: FAL_SEEDANCE_I2V_SUBMIT_URL,
  routeLabel: "Fal Seedance I2V",
});
