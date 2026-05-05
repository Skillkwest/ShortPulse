import { resolveStandardCreateAgentTransportSuccess } from "../../../ai-agent/client/standardTransportResultResolution";
import { sendStandardCreateAgentTurn } from "../../../ai-agent/client/standardStudioAgentTransport";
import { buildStandardCreateAgentContext } from "../../../ai-agent/logic/standardContextBuilder";
import type { CreateAgentRuntimeBinding } from "./createAgentRuntimeBinding";

export const standardCreateAgentRuntimeBinding: CreateAgentRuntimeBinding = {
  buildAgentContext: buildStandardCreateAgentContext,
  sendAgentTurn: sendStandardCreateAgentTurn,
  resolveTransportSuccess: resolveStandardCreateAgentTransportSuccess,
};
