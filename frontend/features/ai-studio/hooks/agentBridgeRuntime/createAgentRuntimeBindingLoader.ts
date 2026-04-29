import type { CreateAgentBridgeRuntimeKind } from "./createAgentBridgeRuntime";
import type { CreateAgentRuntimeBinding } from "./createAgentRuntimeBinding";

let standardRuntimeBindingPromise: Promise<CreateAgentRuntimeBinding> | null = null;
let pulseRuntimeBindingPromise: Promise<CreateAgentRuntimeBinding> | null = null;

const loadStandardCreateAgentRuntimeBinding = () => {
  standardRuntimeBindingPromise ??= import("./standardCreateAgentRuntimeBinding").then(
    (module) => module.standardCreateAgentRuntimeBinding
  );
  return standardRuntimeBindingPromise;
};

const loadPulseCreateAgentRuntimeBinding = () => {
  pulseRuntimeBindingPromise ??= import("./pulseCreateAgentRuntimeBinding").then(
    (module) => module.pulseCreateAgentRuntimeBinding
  );
  return pulseRuntimeBindingPromise;
};

export const loadCreateAgentRuntimeBinding = (kind: CreateAgentBridgeRuntimeKind) =>
  kind === "pulse" ? loadPulseCreateAgentRuntimeBinding() : loadStandardCreateAgentRuntimeBinding();
