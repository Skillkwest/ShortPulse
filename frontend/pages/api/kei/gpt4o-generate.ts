/**
 * Proxies Kie.ai 4o Image (GPT Image 1) generate endpoint.
 * Accepts GPT-4o image payload and returns the upstream response.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const KEI_BASE_URL = "https://api.kie.ai/api/v1";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.KEI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "KEI_API_KEY is not set on the server" });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(`${KEI_BASE_URL}/gpt4o-image/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Kie.ai 4o image generate failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
