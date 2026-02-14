import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";

const FAL_FLUX2PRO_SUBMIT_URL = "https://queue.fal.run/fal-ai/flux-2-pro";

export default createFalSubmitHandler({
  modelId: "fal/flux-2-pro",
  submitUrl: FAL_FLUX2PRO_SUBMIT_URL,
  routeLabel: "Fal FLUX 2 PRO",
});
