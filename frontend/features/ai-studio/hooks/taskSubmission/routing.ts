/**
 * Routing utilities for AI Studio task submission handlers.
 */
import type { SubmissionHandlerRoute } from "./types";
import { getModelConfig } from "../../logic/pricing";

/**
 * Resolves which submission handler family should process a model.
 */
export const resolveSubmissionHandlerRoute = (modelId: string): SubmissionHandlerRoute => {
  const submitHandler = getModelConfig(modelId)?.submitHandler;
  if (!submitHandler) return "unsupported";
  if (submitHandler === "default" || submitHandler === "image" || submitHandler === "video") {
    return submitHandler;
  }
  return "unsupported";
};
