import type { NextApiRequest, NextApiResponse } from "next";

export default function falVeoStatus(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  return res.status(410).json({
    error: "Fal Veo 3.1 status route is disabled.",
    detail: "Use Kie Veo 3.1 instead.",
  });
}
