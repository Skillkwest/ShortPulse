import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";

const FAL_SORA_SUBMIT_URL = "https://queue.fal.run/fal-ai/sora-2/text-to-video/pro";

export default createFalSubmitHandler({
  modelId: "fal-ai/sora-2/text-to-video/pro",
  submitUrl: FAL_SORA_SUBMIT_URL,
  routeLabel: "Fal Sora",
});
