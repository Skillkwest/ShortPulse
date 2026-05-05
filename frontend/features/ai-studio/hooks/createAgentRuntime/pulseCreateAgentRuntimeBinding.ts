import { resolvePulseCreateAgentTransportSuccess } from "../../../ai-agent/client/pulseTransportResultResolution";
import { sendPulseCreateAgentTurn } from "../../../ai-agent/client/pulseStudioAgentTransport";
import { buildPulseCreateAgentContext } from "../../../ai-agent/logic/pulseCreateAgentContextBuilder";
import type { CreateAgentRuntimeBinding } from "./createAgentRuntimeBinding";

export const pulseCreateAgentRuntimeBinding: CreateAgentRuntimeBinding = {
  buildAgentContext: buildPulseCreateAgentContext,
  sendAgentTurn: sendPulseCreateAgentTurn,
  resolveTransportSuccess: resolvePulseCreateAgentTransportSuccess,
};
