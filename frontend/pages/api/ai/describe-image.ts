/**
 * Generates a descriptive caption for an image using OpenAI vision.
 * System prompt comes from frontend/lib/agentPromptsConfig.ts (Agent 2) with env fallback.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { loadAgentPrompt } from "../../../lib/agentPromptLoader";
import { AgentPromptId } from "../../../lib/agentPromptsConfig";
import { requireApiUser } from "../_utils/auth";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const IMAGE_DESCRIBER_ID: AgentPromptId = "OPENAI_PROMPT_IMAGE_DESCRIBE";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!(await requireApiUser(req, res))) return;

  const apiKey = process.env.OPENAI_API_KEY;
  const systemPrompt = loadAgentPrompt(IMAGE_DESCRIBER_ID, process.env[IMAGE_DESCRIBER_ID]);
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
  }
  if (!systemPrompt) {
    return res.status(500).json({ error: `${IMAGE_DESCRIBER_ID} is not set` });
  }

  const { imageUrl } = req.body as { imageUrl?: string };
  if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.trim()) {
    return res.status(400).json({ error: "imageUrl is required" });
  }

  try {
    const visionModel = process.env.OPENAI_VISION_MODEL || "gpt-4.1";
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: visionModel,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Describe the image exactly as you see it." },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res
        .status(response.status)
        .json({ error: "Upstream error", detail, model: visionModel });
    }

    const data = await response.json();
    const description = data?.choices?.[0]?.message?.content?.trim?.() ?? null;
    const promptTokens = data?.usage?.prompt_tokens;
    const completionTokens = data?.usage?.completion_tokens;
    if (!description) {
      return res.status(502).json({ error: "No description returned" });
    }

    return res.status(200).json({
      description,
      usage: {
        inputTokens: typeof promptTokens === "number" ? promptTokens : undefined,
        outputTokens: typeof completionTokens === "number" ? completionTokens : undefined,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Image description failed", detail: String(error) });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
