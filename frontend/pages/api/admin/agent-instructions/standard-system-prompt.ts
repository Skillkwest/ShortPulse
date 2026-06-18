import type { NextApiRequest, NextApiResponse } from "next";
import type { AgentPromptId } from "../../../../lib/agentPromptsConfig";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import {
  RequiredRuntimeAgentPromptMissingError,
  RequiredRuntimeAgentPromptUnavailableError,
  RuntimeAgentPromptVersionMismatchError,
  resolveRequiredRuntimeAgentPrompt,
  saveRuntimeAgentPrompt,
} from "../../../../lib/server/api/runtimeAgentPromptControlPlane";

const STANDARD_SYSTEM_PROMPT_ID: AgentPromptId = "STUDIO_AGENT_SYSTEM";

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

const validateExpectedUpdatedAt = (
  value: unknown
): { ok: true; expectedUpdatedAt: string | null } | { ok: false; message: string } => {
  if (value === undefined) {
    return {
      ok: false,
      message:
        "expectedUpdatedAt is required so non-live prompt content cannot overwrite the live Standard system prompt.",
    };
  }
  if (value === null) {
    return { ok: true, expectedUpdatedAt: null };
  }
  if (typeof value !== "string") {
    return { ok: false, message: "expectedUpdatedAt must be a string or null." };
  }
  const normalized = value.trim();
  return { ok: true, expectedUpdatedAt: normalized.length > 0 ? normalized : null };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/admin/agent-instructions/standard-system-prompt.auth",
    });
    return res.status(500).json({ error: "Failed to load the Standard system prompt." });
  }
  if (!adminUser) return;
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "GET") {
    try {
      const resolvedPrompt = await resolveRequiredRuntimeAgentPrompt({
        promptId: STANDARD_SYSTEM_PROMPT_ID,
      });
      return res.status(200).json({
        promptId: STANDARD_SYSTEM_PROMPT_ID,
        promptBody: resolvedPrompt.promptBody,
        updatedAt: resolvedPrompt.updatedAt,
        updatedByEmail: resolvedPrompt.updatedByEmail,
        source: resolvedPrompt.source,
        degraded: false,
      });
    } catch (error) {
      if (
        error instanceof RequiredRuntimeAgentPromptMissingError ||
        error instanceof RequiredRuntimeAgentPromptUnavailableError ||
        (error instanceof Error &&
          (error.name === "RequiredRuntimeAgentPromptMissingError" ||
            error.name === "RequiredRuntimeAgentPromptUnavailableError"))
      ) {
        return res.status(503).json({
          code: "STANDARD_PROMPT_UNAVAILABLE",
          error: error.message,
        });
      }
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/admin/agent-instructions/standard-system-prompt",
        user: adminUser,
      });
      return res.status(500).json({ error: "Failed to load the Standard system prompt." });
    }
  }

  if (req.method === "PUT") {
    const parsed = validatePromptBody(req.body?.promptBody);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.message });
    }
    const expectedUpdatedAt = validateExpectedUpdatedAt(req.body?.expectedUpdatedAt);
    if (!expectedUpdatedAt.ok) {
      return res.status(400).json({ error: expectedUpdatedAt.message });
    }

    try {
      const savedPrompt = await saveRuntimeAgentPrompt({
        promptId: STANDARD_SYSTEM_PROMPT_ID,
        promptBody: parsed.promptBody,
        expectedUpdatedAt: expectedUpdatedAt.expectedUpdatedAt,
        actorUserId: adminUser.id,
        actorEmail: adminUser.email ?? null,
      });
      return res.status(200).json({
        promptId: STANDARD_SYSTEM_PROMPT_ID,
        promptBody: savedPrompt.promptBody,
        updatedAt: savedPrompt.updatedAt,
        updatedByEmail: savedPrompt.updatedByEmail,
        source: "control_plane",
      });
    } catch (error) {
      if (
        error instanceof RuntimeAgentPromptVersionMismatchError ||
        (error instanceof Error && error.name === "RuntimeAgentPromptVersionMismatchError")
      ) {
        return res.status(409).json({
          code: "PROMPT_STALE",
          error: "The Standard system prompt changed since you loaded it. Reload and try again.",
        });
      }
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/admin/agent-instructions/standard-system-prompt",
        user: adminUser,
      });
      return res.status(500).json({ error: "Failed to save the Standard system prompt." });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
