import type { AgentApiContext } from "../../../prefabs/agent";

type ResolveOutboundAgentContextParams = {
  requestRuntimeMode: "standard" | "pulse";
  safeContext?: AgentApiContext;
  precheckedContext?: AgentApiContext;
};

const hasContextFields = (value: AgentApiContext | undefined): value is AgentApiContext =>
  Boolean(value && Object.keys(value).length > 0);

export const resolveOutboundAgentContext = ({
  requestRuntimeMode,
  safeContext,
  precheckedContext,
}: ResolveOutboundAgentContextParams): AgentApiContext | undefined => {
  const baseContext = hasContextFields(precheckedContext)
    ? precheckedContext
    : hasContextFields(safeContext)
      ? safeContext
      : undefined;

  if (requestRuntimeMode !== "pulse") {
    return baseContext;
  }

  const preservedPulse = precheckedContext?.pulse ?? safeContext?.pulse;
  if (!preservedPulse) {
    return baseContext;
  }

  if (!baseContext) {
    return { pulse: preservedPulse };
  }

  if (baseContext.pulse) {
    return baseContext;
  }

  return {
    ...baseContext,
    pulse: preservedPulse,
  };
};
