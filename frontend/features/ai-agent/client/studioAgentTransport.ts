/**
 * HTTP transport helpers for AI agent requests.
 * Isolates route call details from hook state management logic.
 */
import type { AgentApiRequest, AgentResponse } from "../../../prefabs/agent";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

export type StudioAgentTransportResult =
  | {
      ok: true;
      data: AgentResponse;
    }
  | {
      ok: false;
      status: number;
      detail: string;
    };

/**
 * Send a turn request to the canonical studio-agent endpoint.
 */
export const sendStudioAgentTurn = async (
  body: AgentApiRequest
): Promise<StudioAgentTransportResult> => {
  const response = await fetchWithAuth("/api/ai/studio-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      detail: await response.text(),
    };
  }

  return {
    ok: true,
    data: (await response.json()) as AgentResponse,
  };
};
