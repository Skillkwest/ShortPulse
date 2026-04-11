/**
 * Generic Fal image submit route for all active Fal image models.
 * Delegates to the shared Fal submit proxy after stripping routing metadata.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveFalImageSubmitHandler } from "../../../lib/server/api/falImageRouteRegistry";

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requestBody = asRecord(req.body);
  const modelId = asNonEmptyString(requestBody.modelId);
  if (!modelId) {
    return res.status(400).json({ error: "modelId is required" });
  }

  const submitHandler = resolveFalImageSubmitHandler(modelId);
  if (!submitHandler) {
    return res.status(400).json({ error: "Unsupported Fal image model." });
  }

  delete requestBody.modelId;
  req.body = requestBody;
  return submitHandler(req, res);
}
