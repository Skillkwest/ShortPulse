/**
 * Generates an improved text prompt using OpenAI.
 * System prompt + API key are provided via environment variables to keep secrets server-side.
 */
import path from "path";
import { readFile } from "fs/promises";
import type { NextApiRequest, NextApiResponse } from "next";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const SYSTEM_INSTRUCTIONS_PATH = path.join(process.cwd(), "docs", "openai-agent-system-instructions.md");

const loadSystemPrompt = async (): Promise<string | null> => {
  try {
    const text = await readFile(SYSTEM_INSTRUCTIONS_PATH, "utf-8");
    const fencedMatch = text.match(/```([\\s\\S]*?)```/);
    const candidate = fencedMatch ? fencedMatch[1] : text;
    const trimmed = candidate.trim();
    if (trimmed.length) return trimmed;
  } catch {
    // ignore; fallback to env
  }
  return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  let systemPrompt = await loadSystemPrompt();
  if (!systemPrompt) {
    systemPrompt = process.env.OPENAI_PROMPT_SYSTEM ?? null;
  }
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
  }
  if (!systemPrompt) {
    return res.status(500).json({ error: "OPENAI_PROMPT_SYSTEM is not set" });
  }

  const { prompt } = req.body as { prompt?: string };
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({ error: "Upstream error", detail });
    }

    const data = await response.json();
    const nextPrompt = data?.choices?.[0]?.message?.content?.trim?.() ?? null;
    if (!nextPrompt) {
      return res.status(502).json({ error: "No prompt returned" });
    }

    return res.status(200).json({ prompt: nextPrompt });
  } catch (error) {
    return res.status(500).json({ error: "Prompt generation failed", detail: String(error) });
  }
}
