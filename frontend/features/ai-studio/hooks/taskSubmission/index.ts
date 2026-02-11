/**
 * Public exports for AI Studio task submission handlers.
 */
export { handleVideoModelSubmission } from "./videoHandlers";
export { handleImageModelSubmission } from "./imageHandlers";
export { handleDefaultModelSubmission } from "./defaultHandlers";
export { resolveSubmissionHandlerRoute } from "./routing";
export type { SubmissionHandlerRoute } from "./types";
