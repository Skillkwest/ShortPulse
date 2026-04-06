import type { NextApiRequest, NextApiResponse } from "next";

export default function falSeedanceSubmit(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  return res.status(410).json({
    error: "Fal Seedance text-to-video is disabled.",
    detail: "Use Kie Veo 3.1 or Kie Kling 3.0 instead.",
  });
}
