import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("X-ShortPulse-Route", "fal-veo-image-to-video-status");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return res.status(410).json({
    error: "Fal Veo 3.1 image status route is disabled.",
    detail: "Use Kie Veo 3.1 instead.",
  });
}
