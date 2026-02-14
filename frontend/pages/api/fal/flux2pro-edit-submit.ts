import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";

const FAL_FLUX2PRO_EDIT_SUBMIT_URL = "https://queue.fal.run/fal-ai/flux-2-pro/edit";

export default createFalSubmitHandler({
  modelId: "fal/flux-2-pro/edit",
  submitUrl: FAL_FLUX2PRO_EDIT_SUBMIT_URL,
  routeLabel: "Fal FLUX 2 PRO edit",
});
