/**
 * Client-side helper to request an improved prompt from our API.
 * This keeps OpenAI keys server-side and allows us to iterate on the system prompt centrally.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

export type PromptGenerationResult = {
  prompt: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export const GENERATE_PROMPT_MODEL_ID = "gpt-5.4";

export const postGeneratePrompt = async (
  prompt: string
): Promise<PromptGenerationResult | null> => {
  if (!prompt?.trim()) return null;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetchWithAuth("/api/ai/generate-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
      shortpulseLogScope: "generation",
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const nextPrompt = typeof data?.prompt === "string" ? data.prompt.trim() : null;
    if (!nextPrompt || !nextPrompt.length) return null;
    return {
      prompt: nextPrompt,
      usage: data?.usage,
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
