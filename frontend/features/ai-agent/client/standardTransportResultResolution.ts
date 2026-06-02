/**
 * Standard Create response parser.
 * This module intentionally has no Pulse workflow-session handling.
 */
import type { AgentResponse } from "../../../prefabs/agent";
import {
  resolveStandardCreateResponseContract,
  type StandardCreateResponseContract,
} from "./standardResponseContract";

export type StandardCreateAgentTransportSuccess = StandardCreateResponseContract;

export const resolveStandardCreateAgentTransportSuccess = (
  response: AgentResponse
): StandardCreateAgentTransportSuccess => resolveStandardCreateResponseContract(response);
