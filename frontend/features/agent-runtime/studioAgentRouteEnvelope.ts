import { randomUUID } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import type { AgentContext, AgentMessage } from "../../prefabs/agent";
import type {
  AgentMachineOutcomeFields,
  AgentReasonCode,
} from "../../prefabs/agent/outcomeContract";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";
import { buildAgentMachineOutcome } from "./agentMachineOutcome";
import { setAgentContractVersionHeader } from "./agentContractHeaders";
import {
  STUDIO_AGENT_RATE_LIMIT_MAX_REQUESTS,
  STUDIO_AGENT_RATE_LIMIT_WINDOW_MS,
  isStudioAgentRateLimited,
  parseStudioAgentMessages,
  parseStudioAgentSessionKey,
  readStudioAgentRequestBodyBytes,
  resolveStudioAgentMaxRequestBytes,
  sanitizeStudioAgentContext,
} from "./studioAgentRequestGuards";

export type StudioAgentErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "AGENT_DISABLED"
  | "INVALID_REQUEST"
  | "INVALID_SESSION_KEY"
  | "INVALID_MESSAGE_ROLE"
  | "REQUEST_BODY_TOO_LARGE"
  | "RATE_LIMITED"
  | "MESSAGES_REQUIRED";

export type StudioAgentErrorResponse = {
  code: StudioAgentErrorCode;
  message: string;
  details?: Record<string, unknown>;
  traceId: string;
} & AgentMachineOutcomeFields;

type StudioAgentRequestEnvelopeSuccess = {
  ok: true;
  value: {
    clientSessionKey: string;
    messages: AgentMessage[];
    context: AgentContext;
    incomingCanonical: string | null;
  };
};

type StudioAgentRequestEnvelopeFailure = {
  ok: false;
  status: number;
  payload: StudioAgentErrorResponse;
};

export type StudioAgentRequestEnvelopeResult =
  | StudioAgentRequestEnvelopeSuccess
  | StudioAgentRequestEnvelopeFailure;

export const resolveStudioAgentTraceId = (req: NextApiRequest): string => {
  const headerTraceId = req.headers?.["x-shortpulse-request-id"];
  if (typeof headerTraceId === "string" && headerTraceId.trim().length) {
    return headerTraceId.trim().slice(0, 128);
  }

  const bodyTraceId =
    typeof req.body?.traceId === "string" && req.body.traceId.trim().length
      ? req.body.traceId.trim()
      : null;
  if (bodyTraceId) return bodyTraceId.slice(0, 128);
  return randomUUID();
};

export const setStudioAgentContractHeaders = (res: NextApiResponse, traceId: string): void => {
  setAgentContractVersionHeader(res);
  res.setHeader("x-agent-trace-id", traceId);
};

export const sendStudioAgentError = (
  res: NextApiResponse,
  status: number,
  payload: StudioAgentErrorResponse
): void => {
  const reasonCode = resolveRouteErrorReasonCode(payload.code);
  res.status(status).json({
    ...buildAgentMachineOutcome({
      outcomeClass: "route_error",
      reasonCode,
    }),
    ...payload,
  });
};

const resolveRouteErrorReasonCode = (
  code: StudioAgentErrorCode
): Extract<AgentReasonCode, "REQUEST_INVALID" | "CONFIG_MISSING"> => {
  if (code === "AGENT_DISABLED") return "CONFIG_MISSING";
  return "REQUEST_INVALID";
};

export const isStudioAgentFeatureEnabled = ({
  serverFlag,
  publicFlag,
}: {
  serverFlag: string | undefined;
  publicFlag: string | undefined;
}): boolean =>
  typeof serverFlag === "string"
    ? serverFlag === "true"
    : typeof publicFlag === "string"
      ? publicFlag === "true"
      : true;

export const parseStudioAgentRequestEnvelope = ({
  req,
  userId,
  traceId,
}: {
  req: NextApiRequest;
  userId: string;
  traceId: string;
}): StudioAgentRequestEnvelopeResult => {
  const bodyBytes = readStudioAgentRequestBodyBytes(req.body);
  const maxRequestBytes = resolveStudioAgentMaxRequestBytes(req.body);
  if (bodyBytes > maxRequestBytes) {
    return {
      ok: false,
      status: 413,
      payload: {
        code: "REQUEST_BODY_TOO_LARGE",
        message: "Request body exceeds allowed size limit",
        details: {
          maxBytes: maxRequestBytes,
          actualBytes: bodyBytes,
        },
        traceId,
      },
    };
  }

  if (isStudioAgentRateLimited(userId)) {
    return {
      ok: false,
      status: 429,
      payload: {
        code: "RATE_LIMITED",
        message: "Too many studio-agent requests. Please retry shortly.",
        details: {
          windowMs: STUDIO_AGENT_RATE_LIMIT_WINDOW_MS,
          maxRequests: STUDIO_AGENT_RATE_LIMIT_MAX_REQUESTS,
        },
        traceId,
      },
    };
  }

  const parsedSessionKey = parseStudioAgentSessionKey(req.body?.clientSessionKey);
  if (!parsedSessionKey.ok) {
    return {
      ok: false,
      status: 400,
      payload: {
        code: "INVALID_SESSION_KEY",
        message: parsedSessionKey.message,
        details: parsedSessionKey.details,
        traceId,
      },
    };
  }

  const parsedMessages = parseStudioAgentMessages(req.body?.messages);
  if (!parsedMessages.ok) {
    return {
      ok: false,
      status: 400,
      payload: {
        code: parsedMessages.code,
        message: parsedMessages.message,
        details: parsedMessages.details,
        traceId,
      },
    };
  }

  if (!parsedMessages.messages.length) {
    return {
      ok: false,
      status: 400,
      payload: {
        code: "MESSAGES_REQUIRED",
        message: "messages are required",
        traceId,
      },
    };
  }

  const incomingCanonical =
    typeof req.body?.canonicalPrompt === "string" && req.body.canonicalPrompt.trim().length
      ? (sanitizeGenerationPromptText(req.body.canonicalPrompt.trim()) ?? null)
      : null;

  return {
    ok: true,
    value: {
      clientSessionKey: parsedSessionKey.sessionKey,
      messages: parsedMessages.messages,
      context: sanitizeStudioAgentContext(req.body?.context),
      incomingCanonical,
    },
  };
};
