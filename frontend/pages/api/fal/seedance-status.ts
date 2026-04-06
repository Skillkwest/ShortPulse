import type { NextApiRequest, NextApiResponse } from "next";

export default function falSeedanceStatus(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  return res.status(410).json({
    error: "Fal Seedance status route is disabled.",
    detail: "Use Kie Veo 3.1 or Kie Kling 3.0 instead.",
  });
}
