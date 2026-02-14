import { createFalSubmitHandler } from "../../../lib/server/api/falSubmitProxy";

const FAL_FLUX2_KLEIN_SUBMIT_URL = "https://queue.fal.run/fal-ai/flux-2/klein/9b";

export default createFalSubmitHandler({
  modelId: "fal-ai/flux-2/klein/9b",
  submitUrl: FAL_FLUX2_KLEIN_SUBMIT_URL,
  routeLabel: "Fal FLUX 2 Klein",
});
