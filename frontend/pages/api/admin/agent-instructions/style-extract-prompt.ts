import type { NextApiRequest, NextApiResponse } from "next";
import type { AgentPromptId } from "../../../../lib/agentPromptsConfig";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import {
  resolveRuntimeAgentPrompt,
  saveRuntimeAgentPrompt,
} from "../../../../lib/server/api/runtimeAgentPromptControlPlane";

const STYLE_EXTRACT_PROMPT_ID: AgentPromptId = "OPENAI_PROMPT_STYLE_EXTRACT";

const validatePromptBody = (
  value: unknown
): { ok: true; promptBody: string } | { ok: false; message: string } => {
  if (typeof value !== "string") {
    return { ok: false, message: "promptBody must be a string." };
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return { ok: false, message: "promptBody cannot be empty." };
  }
  return { ok: true, promptBody: normalized };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  if (req.method === "GET") {
    try {
      const resolvedPrompt = await resolveRuntimeAgentPrompt({
        promptId: STYLE_EXTRACT_PROMPT_ID,
      });
      return res.status(200).json({
        promptId: STYLE_EXTRACT_PROMPT_ID,
        promptBody: resolvedPrompt.promptBody ?? "",
        updatedAt: resolvedPrompt.updatedAt,
        updatedByEmail: resolvedPrompt.updatedByEmail,
        source: resolvedPrompt.source,
      });
    } catch (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/admin/agent-instructions/style-extract-prompt",
        user: adminUser,
      });
      return res.status(500).json({ error: "Failed to load style extraction prompt." });
    }
  }

  if (req.method === "PUT") {
    const parsed = validatePromptBody(req.body?.promptBody);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.message });
    }

    try {
      const savedPrompt = await saveRuntimeAgentPrompt({
        promptId: STYLE_EXTRACT_PROMPT_ID,
        promptBody: parsed.promptBody,
        actorUserId: adminUser.id,
        actorEmail: adminUser.email ?? null,
      });
      return res.status(200).json({
        promptId: STYLE_EXTRACT_PROMPT_ID,
        promptBody: savedPrompt.promptBody,
        updatedAt: savedPrompt.updatedAt,
        updatedByEmail: savedPrompt.updatedByEmail,
        source: "control_plane",
      });
    } catch (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/admin/agent-instructions/style-extract-prompt",
        user: adminUser,
      });
      return res.status(500).json({ error: "Failed to save style extraction prompt." });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
