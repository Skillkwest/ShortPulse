/**
 * OpenAI compatibility client.
 * Supports Responses API with Chat Completions-compatible output for existing routes.
 */

type OpenAiMessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export type OpenAiChatMessage = {
  role: "system" | "assistant" | "user";
  content: string | OpenAiMessageContentPart[];
};

type OpenAiCompatRequest = {
  apiKey: string;
  model: string;
  messages: OpenAiChatMessage[];
  timeoutMs: number;
  openAiUrl?: string;
  openAiApiBase?: string;
  env?: NodeJS.ProcessEnv;
};

type OpenAiResponsesRequest = {
  apiKey: string;
  body: Record<string, unknown>;
  timeoutMs: number;
  openAiUrl?: string;
  openAiApiBase?: string;
};

type ResponsesInputMessage = {
  role: "system" | "assistant" | "user";
  content: Record<string, unknown>[];
};

const DEFAULT_OPENAI_API_BASE = "https://api.openai.com/v1";
const DEFAULT_CHAT_COMPLETIONS_URL = `${DEFAULT_OPENAI_API_BASE}/chat/completions`;

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const normalizeOpenAiApiBase = (value: string | undefined): string => {
  const raw = (value ?? "").trim();
  if (!raw.length) return DEFAULT_OPENAI_API_BASE;

  if (raw.endsWith("/chat/completions")) {
    return raw.slice(0, -"/chat/completions".length);
  }
  if (raw.endsWith("/responses")) {
    return raw.slice(0, -"/responses".length);
  }
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

const resolveOpenAiApiBase = ({
  openAiApiBase,
  openAiUrl,
}: {
  openAiApiBase?: string;
  openAiUrl?: string;
}): string => {
  const explicitBase = normalizeOpenAiApiBase(openAiApiBase);
  if (explicitBase !== DEFAULT_OPENAI_API_BASE || (openAiApiBase ?? "").trim().length) {
    return explicitBase;
  }
  return normalizeOpenAiApiBase(openAiUrl);
};

const resolveChatCompletionsUrl = ({
  openAiApiBase,
  openAiUrl,
}: {
  openAiApiBase?: string;
  openAiUrl?: string;
}): string => {
  const explicitUrl = (openAiUrl ?? "").trim();
  if (explicitUrl.length) return explicitUrl;
  return `${normalizeOpenAiApiBase(openAiApiBase)}/chat/completions`;
};

const toResponsesContentPart = (part: OpenAiMessageContentPart): Record<string, unknown> | null => {
  if (part.type === "text") {
    const text = asString(part.text);
    return text ? { type: "input_text", text } : null;
  }
  if (part.type === "image_url") {
    const imageUrl = asString(part.image_url?.url);
    if (!imageUrl) return null;
    const detail = asString(part.image_url?.detail);
    return {
      type: "input_image",
      image_url: imageUrl,
      detail: detail ?? undefined,
    };
  }
  return null;
};

const toResponsesInput = (messages: OpenAiChatMessage[]): ResponsesInputMessage[] => {
  return messages
    .map((message) => {
      if (typeof message.content === "string") {
        const text = asString(message.content);
        if (!text) return null;
        return {
          role: message.role,
          content: [{ type: "input_text", text }],
        };
      }

      const content = message.content
        .map((part) => toResponsesContentPart(part))
        .filter((part): part is Record<string, unknown> => Boolean(part));
      if (!content.length) return null;
      return {
        role: message.role,
        content,
      };
    })
    .filter((entry): entry is ResponsesInputMessage => Boolean(entry));
};

const collectResponseOutputText = (payload: Record<string, unknown>): string => {
  const directOutputText = asString(payload.output_text);
  if (directOutputText) return directOutputText;

  const output = Array.isArray(payload.output) ? payload.output : [];
  const textParts: string[] = [];

  for (const rawItem of output) {
    const item = asObject(rawItem);
    const itemText = asString(item.text);
    if (itemText) textParts.push(itemText);

    const content = Array.isArray(item.content) ? item.content : [];
    for (const rawContent of content) {
      const contentRecord = asObject(rawContent);
      const text = asString(contentRecord.text);
      if (text) {
        textParts.push(text);
      }
    }
  }

  return textParts.join("\n").trim();
};

const toChatCompletionCompatiblePayload = ({
  payload,
  model,
}: {
  payload: Record<string, unknown>;
  model: string;
}): Record<string, unknown> => {
  const usage = asObject(payload.usage);
  const promptTokens = asNumber(usage.input_tokens) ?? asNumber(usage.prompt_tokens);
  const completionTokens = asNumber(usage.output_tokens) ?? asNumber(usage.completion_tokens);
  const totalTokens =
    asNumber(usage.total_tokens) ??
    (typeof promptTokens === "number" && typeof completionTokens === "number"
      ? promptTokens + completionTokens
      : undefined);

  return {
    id: asString(payload.id) ?? undefined,
    object: "chat.completion.compat",
    model: asString(payload.model) ?? model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: collectResponseOutputText(payload),
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      input_tokens: promptTokens,
      output_tokens: completionTokens,
    },
  };
};

const isResponsesEnabled = (env: NodeJS.ProcessEnv): boolean =>
  String(env.SHORTPULSE_OPENAI_RESPONSES_ENABLED ?? "").toLowerCase() === "true";

const isChatFallbackEnabled = (env: NodeJS.ProcessEnv): boolean =>
  String(env.SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED ?? "true").toLowerCase() !== "false";

export const fetchOpenAiCompatibleChatCompletion = async ({
  apiKey,
  model,
  messages,
  timeoutMs,
  openAiUrl,
  openAiApiBase,
  env = process.env,
}: OpenAiCompatRequest): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const chatCompletionsUrl = resolveChatCompletionsUrl({ openAiApiBase, openAiUrl });
  const apiBase = resolveOpenAiApiBase({ openAiApiBase, openAiUrl });

  const postChatCompletions = async (): Promise<Response> => {
    return await fetch(chatCompletionsUrl || DEFAULT_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });
  };

  const postResponses = async (): Promise<Response> => {
    return await fetch(`${apiBase}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: toResponsesInput(messages),
      }),
      signal: controller.signal,
    });
  };

  try {
    if (!isResponsesEnabled(env)) {
      return await postChatCompletions();
    }

    const responsesResult = await postResponses();
    if (responsesResult.ok) {
      const payload = asObject(await responsesResult.json());
      const compatiblePayload = toChatCompletionCompatiblePayload({
        payload,
        model,
      });
      return new Response(JSON.stringify(compatiblePayload), {
        status: responsesResult.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!isChatFallbackEnabled(env)) {
      return responsesResult;
    }

    return await postChatCompletions();
  } finally {
    clearTimeout(timeoutId);
  }
};

export const fetchOpenAiResponse = async ({
  apiKey,
  body,
  timeoutMs,
  openAiUrl,
  openAiApiBase,
}: OpenAiResponsesRequest): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const apiBase = resolveOpenAiApiBase({ openAiApiBase, openAiUrl });

  try {
    return await fetch(`${apiBase}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};
