/**
 * Proxies Fal.ai Nano Banana Pro text-to-image submit requests.
 * Keeps `FAL_KEY` server-side and relays the payload to the Fal queue.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const FAL_NANO_BANANA_PRO_SUBMIT_URL = "https://queue.fal.run/fal-ai/nano-banana-pro";

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
    const upstream = await fetch(FAL_NANO_BANANA_PRO_SUBMIT_URL, {
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
    return res.status(500).json({ error: "Fal Nano Banana Pro submit failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
