/**
 * Thinker/formatter OpenAI pipeline helpers for the AI Studio agent route.
 * Keeps two-stage model orchestration outside the API route handler.
 */
import type { AgentResponse } from "../../../prefabs/agent";

export type ThinkerFormatterResult = {
  parsed: AgentResponse;
  nextCanonical: string | null;
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
}: {
  apiKey: string;
  openAiUrl: string;
  model: string;
  thinkerMessages: unknown[];
  buildFormatterMessages: (semantic: unknown) => unknown[];
  parseAgentJson: (raw: string) => AgentResponse | null;
}): Promise<ThinkerFormatterTurnResult> => {
  const thinkerResp = await fetch(openAiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: thinkerMessages,
    }),
  });

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
  try {
    semantic = JSON.parse(thinkerRaw);
  } catch {
    semantic = { status: "ready", prompt_text: thinkerRaw, change_summary: "", question: null };
  }

  const formatterResp = await fetch(openAiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: buildFormatterMessages(semantic),
    }),
  });

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
      usage: {
        inputTokens: formatterData?.usage?.prompt_tokens,
        outputTokens: formatterData?.usage?.completion_tokens,
      },
    },
  };
};
