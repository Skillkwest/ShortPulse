/**
 * Proxies Kie.ai task status lookups.
 * Accepts `{ taskId }` and forwards to `https://api.kie.ai/api/v1/jobs/queryTask`.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../_utils/auth";
import { resolveProviderRequestOwnership } from "../_utils/generationBilling";

const KEI_BASE_URL = "https://api.kie.ai/api/v1";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const apiKey = process.env.KEI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "KEI_API_KEY is not set on the server" });
  }

  const { taskId } = req.body || {};
  if (!taskId || typeof taskId !== "string") {
    return res.status(400).json({ error: "taskId is required" });
  }
  const ownership = await resolveProviderRequestOwnership({
    userId: user.id,
    providerRequestId: taskId,
  });
  if (ownership !== "owned") {
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

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Kie.ai task status failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
