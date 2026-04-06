import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  res.status(410).json({
    error: "Fal Kling 3.0 image-to-video is disabled.",
    detail: "Use Kie Kling 3.0 or another active video model instead.",
  });
}
