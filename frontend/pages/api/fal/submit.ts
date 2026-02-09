import { createFalSubmitHandler } from "../_utils/falSubmitProxy";

const FAL_SUBMIT_URL = "https://queue.fal.run/fal-ai/flux/dev";

export default createFalSubmitHandler({
  modelId: "fal/flux-2",
  submitUrl: FAL_SUBMIT_URL,
  routeLabel: "Fal submit",
});
