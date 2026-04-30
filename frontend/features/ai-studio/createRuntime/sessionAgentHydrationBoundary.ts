import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import type { CreatePageAgentRuntime } from "./contracts";

export type CreateRuntimeHydrationMode = CreatePageAgentRuntime["kind"];

export type CreateRuntimeAgentHydrationPayload = Pick<
  AiStudioSessionHydrationPayload,
  "workspace" | "agent" | "agentRuntimes"
>;

export const shouldApplySessionAgentHydrationToRuntime = (
  payload: CreateRuntimeAgentHydrationPayload,
  activeRuntimeKind: CreateRuntimeHydrationMode
): boolean => payload.workspace.expertCreateMode === activeRuntimeKind;
