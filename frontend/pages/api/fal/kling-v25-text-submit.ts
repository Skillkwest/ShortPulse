/**
 * Proxies Fal.ai Kling v2.5 Turbo text-to-video submit requests.
 * Keeps FAL_KEY server-side and relays payloads to the queue endpoint.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const FAL_KLING_V25_TEXT_SUBMIT_URL = "https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/text-to-video";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "FAL_KEY is not set on the server" });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetch(FAL_KLING_V25_TEXT_SUBMIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Fal Kling v2.5 text-to-video submit failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
