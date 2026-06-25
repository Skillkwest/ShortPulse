/**
 * Retired direct OpenAI GPT Image 2 generation route.
 * The active GPT Image 2 image lanes run through the queued Kie routes.
 */
import type { NextApiRequest, NextApiResponse } from "next";

type DisabledOpenAiImageRouteResponse = {
  error: "Not found";
};

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<DisabledOpenAiImageRouteResponse>
) {
  return res.status(404).json({ error: "Not found" });
}
