import type { NextApiRequest, NextApiResponse } from "next";

export default function falKlingImageStatus(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  return res.status(410).json({
    error: "Fal Kling 3.0 image status route is disabled.",
    detail: "Use Kie Kling 3.0 instead.",
  });
}
