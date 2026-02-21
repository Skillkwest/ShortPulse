import type { NextApiRequest } from "next";
import { logApiRouteException } from "../../lib/server/api/appErrorLogs";
import {
  readAgentConversationCanonicalPrompt,
  upsertAgentConversationCanonicalPrompt,
} from "../../lib/server/api/agentConversationState";

type StageMarker = (stage: string, startedAt: number) => void;
type ErrorMessageFormatter = (error: unknown) => string;

export const readStudioAgentCanonicalPrompt = async ({
  req,
  userId,
  conversationId,
  canonicalDbEnabled,
  markStage,
  formatErrorMessage,
}: {
  req: NextApiRequest;
  userId: string;
  conversationId: string;
  canonicalDbEnabled: boolean;
  markStage: StageMarker;
  formatErrorMessage: ErrorMessageFormatter;
}): Promise<string | null> => {
  if (!(canonicalDbEnabled && conversationId)) return null;
  const canonicalReadStartedAt = Date.now();
  try {
    return await readAgentConversationCanonicalPrompt({
      userId,
      conversationId,
    });
  } catch (error) {
    console.warn("[studio-agent] canonical db read failed", formatErrorMessage(error));
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai/studio-agent",
      metadata: {
        user_id: userId,
        conversation_id: conversationId,
        stage: "canonical_read",
      },
    });
    return null;
  } finally {
    markStage("canonical_read", canonicalReadStartedAt);
  }
};

export const writeStudioAgentCanonicalPrompt = async ({
  req,
  userId,
  conversationId,
  canonicalPrompt,
  canonicalDbEnabled,
  markStage,
  writeFailureStage,
  formatErrorMessage,
}: {
  req: NextApiRequest;
  userId: string;
  conversationId: string;
  canonicalPrompt: string | null;
  canonicalDbEnabled: boolean;
  markStage: StageMarker;
  writeFailureStage: "canonical_write_v2" | "canonical_write_fast_path";
  formatErrorMessage: ErrorMessageFormatter;
}): Promise<void> => {
  if (!(canonicalDbEnabled && conversationId && canonicalPrompt)) return;
  const canonicalWriteStartedAt = Date.now();
  try {
    await upsertAgentConversationCanonicalPrompt({
      userId,
      conversationId,
      canonicalPrompt,
    });
  } catch (error) {
    console.warn("[studio-agent] canonical db upsert failed", formatErrorMessage(error));
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai/studio-agent",
      metadata: {
        user_id: userId,
        conversation_id: conversationId,
        stage: writeFailureStage,
      },
    });
  } finally {
    markStage("canonical_write", canonicalWriteStartedAt);
  }
};
