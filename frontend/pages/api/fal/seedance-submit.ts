import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";

const FAL_SEEDANCE_SUBMIT_URL =
  "https://queue.fal.run/fal-ai/bytedance/seedance/v1.5/pro/text-to-video";

export default createFalSubmitHandler({
  modelId: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
  submitUrl: FAL_SEEDANCE_SUBMIT_URL,
  routeLabel: "Fal Seedance",
});
