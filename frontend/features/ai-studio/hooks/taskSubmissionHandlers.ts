/**
 * Backward-compatible exports for AI Studio task submission handlers.
 */
export {
  handleDefaultModelSubmission,
  handleImageModelSubmission,
  handleVideoModelSubmission,
  resolveSubmissionHandlerRoute,
} from "./taskSubmission";
export type { SubmissionHandlerRoute } from "./taskSubmission";
