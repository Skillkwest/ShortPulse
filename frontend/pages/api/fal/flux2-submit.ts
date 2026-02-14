import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";

const FAL_FLUX2_SUBMIT_URL = "https://queue.fal.run/fal-ai/flux-2";

export default createFalSubmitHandler({
  modelId: "fal/flux-2",
  submitUrl: FAL_FLUX2_SUBMIT_URL,
  routeLabel: "Fal FLUX 2",
});
