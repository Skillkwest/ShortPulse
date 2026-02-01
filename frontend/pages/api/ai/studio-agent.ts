/**
 * AI Studio Agent API: brokers chat+vision requests to the configured LLM.
 * Keeps system prompt and context handling server-side to protect keys and size limits.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { loadAgentPrompt } from "../../../lib/agentPromptLoader";
import type { AgentContext, AgentMessage, AgentResponse } from "../../../features/ai-agent/types";

const OPENAI_URL = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1") + "/chat/completions";
// More capable default; can be overridden via OPENAI_MODEL env.
const DEFAULT_MODEL = "gpt-4.1";
const MAX_MESSAGES = 24;
const MAX_IMAGE_BYTES = 350 * 1024;
const MAX_MEDIA = 3;
const canonicalPromptStore = new Map<string, string>();

const stopwords = new Set([
  "the",
  "and",
  "with",
  "from",
  "into",
  "onto",
  "over",
  "under",
  "a",
  "an",
  "of",
  "in",
  "on",
  "to",
  "for",
  "by",
  "at",
  "as",
  "is",
  "are",
  "was",
  "were",
]);

const significantTokens = (text: string, limit = 6): string[] => {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 4 && !stopwords.has(t))
    .sort((a, b) => b.length - a.length)
    .slice(0, limit);
};

const preservesContext = (canonical: string, updated: string): boolean => {
  const sig = significantTokens(canonical);
  if (!sig.length) return true;
  const updatedText = updated.toLowerCase();
  const present = sig.filter((t) => updatedText.includes(t));
  return present.length >= Math.max(3, Math.ceil(sig.length / 2));
};

type OpenAIChatMessage =
  | { role: "system" | "assistant" | "user"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" } }
      >;
    };

const estimateBase64Bytes = (dataUrl: string) => {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return dataUrl.length;
  const base64 = dataUrl.slice(commaIndex + 1);
  return Math.floor((base64.length * 3) / 4);
};

const parseMessages = (rawMessages: unknown): AgentMessage[] => {
  if (!Array.isArray(rawMessages)) return [];
  return rawMessages
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as AgentMessage).role;
      const content = (item as AgentMessage).content;
      if (!content || typeof content !== "string") return null;
      if (role !== "user" && role !== "assistant" && role !== "system" && role !== "observation") return null;
      return { role, content };
    })
    .filter(Boolean)
    .slice(-MAX_MESSAGES) as AgentMessage[];
};

const safeContext = (context?: AgentContext): AgentContext => {
  if (!context) return {};
  const media =
    context.media
      ?.filter((item) => {
        // Only allow images for vision payloads; videos are excluded.
        if (item?.kind && item.kind !== "image") return false;
        const isDataUrl = typeof item?.dataUrl === "string" && item.dataUrl.startsWith("data:");
        const isHttpsUrl = typeof item?.url === "string" && item.url.startsWith("https://");
        if (!isDataUrl && !isHttpsUrl) return false;
        if (isDataUrl && estimateBase64Bytes(item.dataUrl as string) > MAX_IMAGE_BYTES) return false;
        return true;
      })
      .slice(0, MAX_MEDIA) ?? [];

  return {
    activePrompt: context.activePrompt ?? null,
    modelId: context.modelId ?? null,
    mode: context.mode,
    creditBalance: context.creditBalance ?? null,
    references: Array.isArray(context.references) ? context.references.slice(0, 24) : [],
    media,
    selectedReferenceIds: Array.isArray(context.selectedReferenceIds) ? context.selectedReferenceIds.slice(0, 8) : [],
    focusedSource: context.focusedSource ?? undefined,
    focusedReferenceId: context.focusedReferenceId ?? null,
    lastAssistantMessage: context.lastAssistantMessage ?? null,
    modeHint: context.modeHint ?? undefined,
  };
};

const buildOpenAiMessages = (messages: AgentMessage[], context: AgentContext, systemPrompt: string): OpenAIChatMessage[] => {
  const chat: OpenAIChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: `CONTEXT:\n${JSON.stringify(context)}` },
  ];

  if (context.lastAssistantMessage) {
    chat.push({ role: "assistant", content: context.lastAssistantMessage });
  }

  if (context.media && context.media.length) {
    chat.push({
      role: "user",
      content: [
        { type: "text", text: "Here are media previews (downscaled):" },
        ...context.media.map((item) => ({
          type: "image_url" as const,
          image_url: { url: (item.dataUrl as string) || (item.url as string), detail: "low" as const },
        })),
      ],
    });
  }

  messages.forEach((message) => {
    chat.push({
      role: message.role === "observation" ? "assistant" : message.role,
      content: message.content,
    });
  });
  return chat;
};
const buildThinkerMessages = (payload: any, prompt: string): OpenAIChatMessage[] => [
  { role: "system", content: prompt },
  { role: "user", content: JSON.stringify(payload) },
];

const buildFormatterMessages = (semantic: any, prompt: string): OpenAIChatMessage[] => [
  { role: "system", content: prompt },
  { role: "user", content: JSON.stringify(semantic) },
];

const parseAgentJson = (raw: string): AgentResponse | null => {
  const candidates: string[] = [];
  const trimmed = raw.trim();
  if (trimmed) candidates.push(trimmed);
  const braceMatch = trimmed.match(/{[\s\S]*}/);
  if (braceMatch) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== "object") continue;
      const message = typeof parsed.message === "string" ? parsed.message : "";
      const actions = typeof parsed.actions === "object" ? parsed.actions : undefined;
      const usage = typeof parsed.usage === "object" ? parsed.usage : undefined;
      return { message, actions, usage };
    } catch (_error) {
      continue;
    }
  }
  return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Feature gate: defaults to enabled; can be disabled explicitly server-side.
  const featureEnabled =
    process.env.STUDIO_AGENT_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT === "true" ||
    process.env.STUDIO_AGENT_ENABLED === undefined;
  if (!featureEnabled) {
    return res.status(503).json({ error: "Studio agent is disabled" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
  }
  const systemPrompt = loadAgentPrompt("STUDIO_AGENT_SYSTEM", process.env.STUDIO_AGENT_SYSTEM);
  const thinkerPrompt = loadAgentPrompt("STUDIO_AGENT_THINKER", process.env.STUDIO_AGENT_THINKER);
  const formatterPrompt = loadAgentPrompt("STUDIO_AGENT_FORMATTER", process.env.STUDIO_AGENT_FORMATTER);
  if (!systemPrompt) {
    return res.status(500).json({ error: "STUDIO_AGENT_SYSTEM prompt missing" });
  }

  const messages = parseMessages(req.body?.messages);
  // conversationId is currently informational (could be logged/audited later)
  const conversationId = typeof req.body?.conversationId === "string" ? req.body.conversationId : null;
  const context = safeContext(req.body?.context);
  const incomingCanonical =
    typeof req.body?.canonicalPrompt === "string" && req.body.canonicalPrompt.trim().length
      ? req.body.canonicalPrompt.trim()
      : null;
  const storedCanonical = conversationId ? canonicalPromptStore.get(conversationId) ?? null : null;
  const canonicalPrompt = incomingCanonical ?? storedCanonical ?? null;
  const effectiveCanonical = canonicalPrompt ?? context.lastAssistantMessage ?? null;

  if (!messages.length) {
    return res.status(400).json({ error: "messages are required" });
  }

  const openAiMessages = buildOpenAiMessages(messages, context, systemPrompt);

  try {
    const useV2 = process.env.NEXT_PUBLIC_AGENT_V2 !== "false";

    if (useV2 && thinkerPrompt && formatterPrompt) {
      const contextType =
        context.media && context.media.length
          ? "image"
          : context.activePrompt || context.references?.length
            ? "prompt"
            : "chat";

      const thinkerPayload = {
        context_type: contextType,
        canonical_prompt: effectiveCanonical,
        user_input: messages[messages.length - 1]?.content ?? "",
        edit_instructions:
          effectiveCanonical && (messages[messages.length - 1]?.content ?? "").trim().length
            ? `Edit the canonical prompt in place.\nCanonical prompt:\n${effectiveCanonical}\n\nUser change:\n${messages[messages.length - 1]?.content ?? ""}`
            : null,
        context_payload:
          contextType === "prompt"
            ? context.activePrompt ?? context.references?.[0]?.promptSnippet ?? ""
            : contextType === "image"
              ? "image provided"
              : context.lastAssistantMessage ?? "",
        mode_hint: context.modeHint ?? null,
      };

      const thinkerMessages = buildThinkerMessages(thinkerPayload, thinkerPrompt);

      const thinkerResp = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
          messages: thinkerMessages,
        }),
      });

      if (!thinkerResp.ok) {
        const detail = await thinkerResp.text();
        return res.status(thinkerResp.status).json({ error: "Upstream error (thinker)", detail });
      }

      const thinkerData = await thinkerResp.json();
      const thinkerRaw = thinkerData?.choices?.[0]?.message?.content ?? "";
      let semantic: any = null;
      try {
        semantic = JSON.parse(thinkerRaw);
      } catch (_e) {
        semantic = { status: "ready", prompt_text: thinkerRaw, change_summary: "", question: null };
      }

      const formatterMessages = buildFormatterMessages(semantic, formatterPrompt);

      const formatterResp = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
          messages: formatterMessages,
        }),
      });

      if (!formatterResp.ok) {
        const detail = await formatterResp.text();
        return res.status(formatterResp.status).json({ error: "Upstream error (formatter)", detail });
      }

      const formatterData = await formatterResp.json();
      const formatterRaw = formatterData?.choices?.[0]?.message?.content ?? "";
      const parsed = parseAgentJson(formatterRaw) ?? { message: formatterRaw || "No response", actions: undefined };
      const nextCanonical =
        parsed?.actions?.apply_prompt ??
        parsed?.message ??
        effectiveCanonical ??
        null;

      // Validate context preservation; if drift detected, fall back to prior canonical.
      if (effectiveCanonical && nextCanonical && !preservesContext(effectiveCanonical, nextCanonical)) {
        parsed.message = parsed.message || "Preserved prior prompt to avoid drift.";
        parsed.actions = parsed.actions ?? {};
        parsed.actions.apply_prompt = effectiveCanonical;
        parsed.actions.referenceCard = parsed.actions.referenceCard ?? { title: "Prompt", prompt: effectiveCanonical };
      }

      if (conversationId && nextCanonical) {
        canonicalPromptStore.set(conversationId, nextCanonical);
      }

      return res.status(200).json({
        ...parsed,
        usage: {
          inputTokens: formatterData?.usage?.prompt_tokens,
          outputTokens: formatterData?.usage?.completion_tokens,
        },
        canonicalPrompt: nextCanonical,
      });
    }

    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        messages: openAiMessages,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({ error: "Upstream error", detail });
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content;
    const contentText =
      typeof rawContent === "string"
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent.map((part: any) => (part?.text ? String(part.text) : "")).join("\n").trim()
          : "";

    const parsed = parseAgentJson(contentText) ?? { message: contentText || "No response", actions: undefined };
    const nextCanonical =
      parsed?.actions?.apply_prompt ??
      parsed?.message ??
      canonicalPrompt ??
      null;

    if (conversationId && nextCanonical) {
      canonicalPromptStore.set(conversationId, nextCanonical);
    }

    return res.status(200).json({
      ...parsed,
      usage: {
        inputTokens: data?.usage?.prompt_tokens,
        outputTokens: data?.usage?.completion_tokens,
      },
      canonicalPrompt: nextCanonical,
    });
  } catch (error) {
    return res.status(500).json({ error: "Agent call failed", detail: String(error) });
  }
}
