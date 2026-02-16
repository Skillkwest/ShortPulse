/**
 * Thinker/formatter OpenAI pipeline helpers for the AI Studio agent route.
 * Keeps two-stage model orchestration outside the API route handler.
 */
import type { AgentResponse } from "../../../prefabs/agent";

export type ThinkerFormatterResult = {
  parsed: AgentResponse;
  nextCanonical: string | null;
  semanticStatus: string | null;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

type ThinkerFormatterError = {
  ok: false;
  stage: "thinker" | "formatter";
  status: number;
  detail: string;
};

type ThinkerFormatterSuccess = {
  ok: true;
  result: ThinkerFormatterResult;
};

export type ThinkerFormatterTurnResult = ThinkerFormatterSuccess | ThinkerFormatterError;

/**
 * Runs thinker -> formatter calls and returns normalized parsed output.
 */
export const runThinkerFormatterTurn = async ({
  apiKey,
  openAiUrl,
  model,
  thinkerMessages,
  buildFormatterMessages,
  parseAgentJson,
  timeoutMs = 20000,
}: {
  apiKey: string;
  openAiUrl: string;
  model: string;
  thinkerMessages: unknown[];
  buildFormatterMessages: (semantic: unknown) => unknown[];
  parseAgentJson: (raw: string) => AgentResponse | null;
  timeoutMs?: number;
}): Promise<ThinkerFormatterTurnResult> => {
  const fetchStage = async (messages: unknown[]) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(openAiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
        }),
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let thinkerResp: Response;
  try {
    thinkerResp = await fetchStage(thinkerMessages);
  } catch (error) {
    return {
      ok: false,
      stage: "thinker",
      status: 504,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  if (!thinkerResp.ok) {
    return {
      ok: false,
      stage: "thinker",
      status: thinkerResp.status,
      detail: await thinkerResp.text(),
    };
  }

  const thinkerData = await thinkerResp.json();
  const thinkerRaw = thinkerData?.choices?.[0]?.message?.content ?? "";
  let semantic: unknown = null;
  let semanticStatus: string | null = null;
  try {
    semantic = JSON.parse(thinkerRaw);
    if (
      semantic &&
      typeof semantic === "object" &&
      typeof (semantic as Record<string, unknown>).status === "string"
    ) {
      semanticStatus = (semantic as Record<string, unknown>).status as string;
    }
  } catch {
    semantic = { status: "ready", prompt_text: thinkerRaw };
    semanticStatus = "ready";
  }

  let formatterResp: Response;
  try {
    formatterResp = await fetchStage(buildFormatterMessages(semantic));
  } catch (error) {
    return {
      ok: false,
      stage: "formatter",
      status: 504,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  if (!formatterResp.ok) {
    return {
      ok: false,
      stage: "formatter",
      status: formatterResp.status,
      detail: await formatterResp.text(),
    };
  }

  const formatterData = await formatterResp.json();
  const formatterRaw = formatterData?.choices?.[0]?.message?.content ?? "";
  const parsed = parseAgentJson(formatterRaw) ?? {
    message: formatterRaw || "No response",
    actions: undefined,
  };
  const nextCanonical = parsed?.actions?.applyPrompt ?? parsed?.message ?? null;

  return {
    ok: true,
    result: {
      parsed,
      nextCanonical,
      semanticStatus,
      usage: {
        inputTokens: formatterData?.usage?.prompt_tokens,
        outputTokens: formatterData?.usage?.completion_tokens,
      },
    },
  };
};
