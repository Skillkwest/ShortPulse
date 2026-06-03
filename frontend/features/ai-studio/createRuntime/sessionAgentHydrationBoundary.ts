import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import type { CreatePageAgentRuntime } from "./contracts";

export type CreateRuntimeHydrationMode = CreatePageAgentRuntime["kind"];

export type CreateRuntimeAgentHydrationPayload = {
  workspace: Pick<
    AiStudioSessionHydrationPayload["workspace"],
    "expertCreateMode" | "standardPrompt" | "activePulsePresetId" | "pulseSessionInstanceId"
  >;
  agent: AiStudioSessionHydrationPayload["agent"];
  agentRuntimes: AiStudioSessionHydrationPayload["agentRuntimes"];
};

export const shouldApplySessionAgentHydrationToRuntime = (
  payload: CreateRuntimeAgentHydrationPayload,
  activeRuntimeKind: CreateRuntimeHydrationMode
): boolean => payload.workspace.expertCreateMode === activeRuntimeKind;
