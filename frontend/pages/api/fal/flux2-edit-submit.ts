import { createFalSubmitHandler } from "../_utils/falSubmitProxy";

const FAL_FLUX2_EDIT_SUBMIT_URL = "https://queue.fal.run/fal-ai/flux-2/edit";

export default createFalSubmitHandler({
  modelId: "fal/flux-2/edit",
  submitUrl: FAL_FLUX2_EDIT_SUBMIT_URL,
  routeLabel: "Fal FLUX 2 edit",
});
