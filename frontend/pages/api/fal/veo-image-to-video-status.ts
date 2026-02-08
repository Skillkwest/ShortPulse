/**
 * Proxies Fal.ai Veo 3.1 image-to-video status requests (queue polling).
 * Keeps FAL_KEY server-side and forwards payloads to the Fal queue.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const FAL_VEO_I2V_STATUS_URL = "https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "FAL_KEY is not set on the server" });
  }

  const { requestId } = req.body || {};
  if (!requestId || typeof requestId !== "string") {
    return res.status(400).json({ error: "Missing requestId" });
  }

  const controller = new AbortController();
  // Veo status calls can take time to materialize; give them breathing room.
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const upstream = await fetch(`${FAL_VEO_I2V_STATUS_URL}/${requestId}`, {
      method: "GET",
      headers: {
        Authorization: `Key ${apiKey}`,
      },
      signal: controller.signal,
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Fal Veo image-to-video status failed", detail: String(error) });
  } finally {
    clearTimeout(timeoutId);
  }
}
