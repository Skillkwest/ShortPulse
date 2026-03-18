/**
 * AI Studio submission reference resolver.
 * Limits generation-task submission to tool modes that are allowed to forward reference media.
 */
import { useCallback } from "react";
import type { ToolId } from "../types";

type ResolvedReferenceInputs = {
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
};

type UseAiStudioSubmissionReferenceResolverParams = {
  resolveReferenceInputsForTool: (tool: ToolId | null) => ResolvedReferenceInputs;
};

/**
 * Returns a submission-scoped resolver that gates reference input forwarding by tool type.
 */
export const useAiStudioSubmissionReferenceResolver = ({
  resolveReferenceInputsForTool,
}: UseAiStudioSubmissionReferenceResolverParams) => {
  const resolveSubmissionReferenceInputsForTool = useCallback(
    (tool: ToolId | null): ResolvedReferenceInputs => {
      if (tool === "edit" || tool === "image" || tool === "video" || tool === "kling") {
        return resolveReferenceInputsForTool(tool);
      }
      return {
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
      };
    },
    [resolveReferenceInputsForTool]
  );

  return {
    resolveSubmissionReferenceInputsForTool,
  };
};
