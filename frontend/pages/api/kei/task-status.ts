/**
 * Proxies Kie.ai task status lookups.
 * Accepts `{ taskId }` and forwards to `https://api.kie.ai/api/v1/jobs/queryTask`.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { resolveProviderRequestOwnership } from "../../../lib/server/api/generationBilling";
import { logGenerationFailure } from "../../../lib/server/api/appErrorLogs";

const KEI_BASE_URL = "https://api.kie.ai/api/v1";

const readJsonSafe = async (
  response: Response | { text?: () => Promise<string>; json?: () => Promise<unknown> }
): Promise<Record<string, unknown>> => {
  if (typeof response.text === "function") {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { error: "Non-JSON response from Kie.ai", raw: text.slice(0, 4000) };
    }
  }

  if (typeof response.json === "function") {
    try {
      const parsed = await response.json();
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return { error: "Non-JSON response from Kie.ai" };
    }
  }

  return {};
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const routeLabel = "kei/task-status";
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const apiKey = process.env.KEI_API_KEY;
  if (!apiKey) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.kei_task_status.config_missing",
      message: "KEI_API_KEY is not set on the server",
      statusCode: 500,
      userId: user.id,
    });
    return res.status(500).json({ error: "KEI_API_KEY is not set on the server" });
  }

  const { taskId } = req.body || {};
  if (!taskId || typeof taskId !== "string") {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.kei_task_status.validation_failed",
      message: "taskId is required",
      statusCode: 400,
      userId: user.id,
    });
    return res.status(400).json({ error: "taskId is required" });
  }
  const ownership = await resolveProviderRequestOwnership({
    userId: user.id,
    providerRequestId: taskId,
  });
  if (ownership !== "owned") {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.kei_task_status.ownership_forbidden",
      message: "Forbidden",
      statusCode: 403,
      userId: user.id,
      metadata: {
        task_id: taskId,
        ownership,
      },
    });
    return res.status(403).json({ error: "Forbidden" });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(`${KEI_BASE_URL}/jobs/queryTask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ taskId }),
      signal: controller.signal,
    });

    const data = await readJsonSafe(upstream);
    if (!upstream.ok) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.kei_task_status.upstream_error",
        message:
          (typeof data.error === "string" && data.error) ||
          (typeof data.message === "string" && data.message) ||
          "Kie.ai task status failed",
        statusCode: upstream.status,
        userId: user.id,
        metadata: {
          task_id: taskId,
          upstream_payload: data,
        },
      });
    }
    return res.status(upstream.status).json(data);
  } catch (error) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.kei_task_status.transport_error",
      message: "Kie.ai task status failed",
      statusCode: 500,
      stack: error instanceof Error ? (error.stack ?? null) : null,
      userId: user.id,
      metadata: {
        task_id: taskId,
        detail: String(error),
      },
    });
    return res.status(500).json({ error: "Kie.ai task status failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
