import type { NextApiRequest, NextApiResponse } from "next";

export default function falVeoImageToVideoSubmit(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  return res.status(410).json({
    error: "Fal Veo 3.1 image-to-video is disabled.",
    detail: "Use Kie Veo 3.1 or another active video model instead.",
  });
}
