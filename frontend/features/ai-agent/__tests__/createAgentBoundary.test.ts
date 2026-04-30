import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readFrontendFile = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

const collectSourceFiles = (dir: string): string[] => {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const absolutePath = path.join(dir, entry);
    if (
      absolutePath.includes(`${path.sep}node_modules${path.sep}`) ||
      absolutePath.includes(`${path.sep}.next${path.sep}`) ||
      absolutePath.includes(`${path.sep}mini-ecosystem${path.sep}`) ||
      absolutePath.includes(`${path.sep}__tests__${path.sep}`)
    ) {
      return [];
    }
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) return collectSourceFiles(absolutePath);
    return /\.(ts|tsx)$/.test(entry) ? [absolutePath] : [];
  });
};

describe("Create agent mode boundaries", () => {
  it("keeps the public useAiAgent compatibility wrapper Standard-only", () => {
    const source = readFrontendFile("features/ai-agent/useAiAgent.ts");
    const typesSource = readFrontendFile("features/ai-agent/useAiAgentTypes.ts");
    const legacyCompatSource = readFrontendFile("features/ai-agent/legacy/useAiAgentCompat.ts");

    expect(source).not.toContain("pulseTransportResultResolution");
    expect(source).not.toContain("pulseStudioAgentTransport");
    expect(source).not.toContain("buildPulseCreateAgentContext");
    expect(source).not.toContain("logic/contextBuilder");
    expect(source).toContain('Omit<UseAiAgentOptions, "runtimeMode">');
    expect(source).toContain('requestRuntimeMode: "standard"');
    expect(typesSource).not.toContain("runtimeMode?:");
    expect(legacyCompatSource).toContain("runtimeMode?: AgentRuntimeMode");
  });

  it("keeps Pulse context serialization behind a Pulse-owned module name", () => {
    const pulseHook = readFrontendFile("features/ai-agent/usePulseCreateAgent.ts");

    expect(pulseHook).toContain("pulseCreateAgentContextBuilder");
    expect(pulseHook).not.toContain('"./logic/contextBuilder"');
  });

  it("keeps generic client transport helpers out of mode selection and workflow parsing", () => {
    const transportSource = readFrontendFile("features/ai-agent/client/studioAgentTransport.ts");
    const compatibilityParserSource = readFrontendFile(
      "features/ai-agent/client/transportResultResolution.ts"
    );

    expect(transportSource).not.toContain("sendStudioAgentTurn =");
    expect(transportSource).not.toContain('runtimeMode === "pulse"');
    expect(compatibilityParserSource).not.toContain("workflowSession");
    expect(compatibilityParserSource).not.toContain("resolveStudioAgentTransportSuccess");
  });

  it("keeps the retired shared expert panel out of source", () => {
    const sourceFiles = collectSourceFiles(path.join(process.cwd(), "features", "ai-studio"));
    const sourceReferences = sourceFiles.filter((filePath) =>
      readFileSync(filePath, "utf8").includes("ExpertCreatePanelView")
    );

    expect(sourceReferences).toEqual([]);
  });

  it("keeps legacy mode-switching useAiAgent out of production imports", () => {
    const frontendRoot = process.cwd();
    const sourceFiles = [
      ...collectSourceFiles(path.join(frontendRoot, "features")),
      ...collectSourceFiles(path.join(frontendRoot, "pages")),
    ];
    const productionImporters = sourceFiles
      .filter(
        (filePath) =>
          !filePath.includes(`${path.sep}features${path.sep}ai-agent${path.sep}legacy${path.sep}`)
      )
      .filter((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return source.includes("legacy/useAiAgentCompat");
      });

    expect(productionImporters).toEqual([]);
  });

  it("keeps the Create bridge from instantiating both mode-owned agent hooks", () => {
    const bridgeSource = readFrontendFile("features/ai-studio/hooks/useAiStudioAgentBridge.ts");
    const bridgeRuntimeSource = readFrontendFile(
      "features/ai-studio/hooks/agentBridgeRuntime/createAgentBridgeRuntime.ts"
    );
    const bridgeActiveAgentSource = readFrontendFile(
      "features/ai-studio/hooks/agentBridgeRuntime/useCreateAgentBridgeActiveAgent.ts"
    );
    const standardRuntimeBindingSource = readFrontendFile(
      "features/ai-studio/hooks/agentBridgeRuntime/standardCreateAgentRuntimeBinding.ts"
    );
    const orchestrationPolicySource = readFrontendFile(
      "features/ai-studio/hooks/agentOrchestration/createAgentOrchestrationRuntimePolicy.ts"
    );

    expect(bridgeSource).not.toContain("useStandardCreateAgent");
    expect(bridgeSource).not.toContain("usePulseCreateAgent");
    expect(bridgeSource).not.toContain("const standardAgent");
    expect(bridgeSource).not.toContain("const pulseAgent");
    expect(bridgeSource).not.toContain("activeAgent = isPulseCreateMode ? pulseAgent");
    expect(bridgeSource).not.toContain("sendPulseActivationToAgent");
    expect(bridgeSource).not.toContain("import { sendPulseCreateAgentTurn");
    expect(bridgeSource).not.toContain("import { resolvePulseCreateAgentTransportSuccess");
    expect(bridgeSource).not.toContain("import { buildPulseCreateAgentContext");
    expect(bridgeSource).not.toContain("import { sendStandardCreateAgentTurn");
    expect(bridgeSource).not.toContain("import { resolveStandardCreateAgentTransportSuccess");
    expect(bridgeSource).not.toContain("import { buildStandardCreateAgentContext");
    expect(bridgeSource).not.toContain("pulseStudioAgentTransport");
    expect(bridgeSource).not.toContain("pulseTransportResultResolution");
    expect(bridgeSource).not.toContain("pulseCreateAgentContextBuilder");
    expect(bridgeSource).not.toContain("standardStudioAgentTransport");
    expect(bridgeSource).not.toContain("standardTransportResultResolution");
    expect(bridgeSource).not.toContain("standardContextBuilder");
    expect(bridgeSource).not.toContain("createPulsePresets");
    expect(bridgeSource).not.toContain("pulseCreateAgentRuntimeBinding");
    expect(bridgeSource).not.toContain("standardCreateAgentRuntimeBinding");
    expect(bridgeSource).not.toContain("useCreateAgentStateCore");
    expect(bridgeSource).not.toContain("loadCreateAgentRuntimeBinding");
    expect(bridgeSource).not.toContain("requestRuntimeMode:");
    expect(bridgeSource).not.toContain("allowSessionNamespaceOverride:");
    expect(bridgeSource).not.toContain("sessionNamespace:");
    expect(bridgeSource).not.toContain("workspace.expertCreateMode");
    expect(bridgeSource).toContain("type StandardCreateAgentBridgeRuntimeConfig");
    expect(bridgeSource).toContain("type PulseCreateAgentBridgeRuntimeConfig");
    expect(bridgeSource).toContain("createAgentRuntime: CreateAgentBridgeRuntimeConfig");
    expect(bridgeSource).not.toContain("standardPrompt: string;");
    expect(bridgeSource).not.toContain("pulsePrompt: string;");
    expect(bridgeSource).not.toContain(
      "const activeCreatePrompt = isPulseCreateMode ? pulsePrompt : standardPrompt"
    );
    expect(bridgeSource).toContain("const activeCreatePrompt = createAgentRuntime.prompt");
    expect(bridgeSource).toContain("prompt: activeCreatePrompt");
    expect(bridgeSource).toContain("./agentBridgeRuntime/useCreateAgentBridgeActiveAgent");
    expect(bridgeSource).toContain("./agentBridgeRuntime/createAgentBridgePersistenceRuntime");
    expect(bridgeActiveAgentSource).not.toContain("./createAgentRuntimeBindingLoader");
    expect(bridgeActiveAgentSource).toContain("standardCreateAgentRuntimeBinding");
    expect(bridgeActiveAgentSource).toContain('import("./pulseCreateAgentRuntimeBinding")');
    expect(bridgeActiveAgentSource).toContain("useCreateAgentStateCore");
    expect(bridgeSource).not.toContain('} from "./agentBridgeRuntime/pulsePresetRestart"');
    expect(bridgeSource).not.toContain("type RestartCreatePulsePresetParams");
    expect(bridgeSource).not.toContain("studio_agent_pulse_restart_requested");
    expect(bridgeSource).not.toContain("studio_agent_pulse_restart_blocked_missing_session");
    expect(bridgeRuntimeSource).not.toContain("pulseSessionState");
    expect(orchestrationPolicySource).not.toContain("pulseSessionState");
    expect(standardRuntimeBindingSource).not.toContain("workflowSession");
    expect(standardRuntimeBindingSource).not.toContain("Pulse");
  });

  it("keeps custom Pulse preference loading out of page-root Create state", () => {
    const pageSource = readFrontendFile("pages/ai-studio.tsx");
    const panelPropSource = readFrontendFile("features/ai-studio/hooks/useAiStudioPanelProps.ts");

    expect(pageSource).not.toContain("useCreatePulsePresetPanelPreference");
    expect(pageSource).not.toContain("CreatePulsePreferenceProvider");
    expect(pageSource).not.toContain("CreatePulsePreferenceRuntime");
    expect(pageSource).not.toContain("savedCreatePulsePresets");
    expect(pageSource).not.toContain("selectedCreatePulsePresetIds");
    expect(panelPropSource).not.toContain("savedCreatePulsePresets");
    expect(panelPropSource).not.toContain("selectedCreatePulsePresetIds");
    expect(panelPropSource).not.toContain("savedPulsePresets");
    expect(panelPropSource).not.toContain("selectedPulsePresetIds");
  });

  it("keeps Pulse workflow implementation helpers out of page-root static imports", () => {
    const pageSource = readFrontendFile("pages/ai-studio.tsx");
    const pulseReconciliationSource = readFrontendFile(
      "features/ai-studio/hooks/createPulsePageRuntime/usePulseWorkflowSessionReconciliation.ts"
    );

    expect(pageSource).not.toContain("isCreatePulseBuiltInPresetId");
    expect(pageSource).not.toContain('from "../features/ai-studio/logic/pulseWorkflowSession"');
    expect(pageSource).not.toContain('import("../features/ai-studio/logic/pulseWorkflowSession")');
    expect(pulseReconciliationSource).toContain('import("../../logic/pulseWorkflowSession")');
  });

  it("keeps Standard page context handoff on the neutral context resolver", () => {
    const pageSource = readFrontendFile("pages/ai-studio.tsx");
    const pulsePageRuntimeSource = readFrontendFile(
      "features/ai-studio/hooks/createPulsePageRuntime/useCreatePulsePresetPageRuntime.ts"
    );

    expect(pageSource).toContain("useCreatePulsePresetPageRuntime");
    expect(pageSource).toContain("standardCreateAgentContextResolver");
    expect(pageSource).toContain("pulseCreateAgentContextResolver");
    expect(pageSource).toContain("const createAgentBridgeRuntime = useMemo");
    expect(pageSource).toContain('kind: "standard" as const');
    expect(pageSource).toContain('kind: "pulse" as const');
    expect(pageSource).toContain("getAgentContext: standardCreateAgentContextResolver");
    expect(pageSource).toContain("getAgentContext: pulseCreateAgentContextResolver");
    expect(pageSource).toContain("createAgentRuntime: createAgentBridgeRuntime");
    expect(pageSource).not.toContain("createModeAgentContextResolver");
    expect(pageSource).not.toContain("getAgentContext: getPulseAwareAgentContext");
    expect(pageSource).not.toContain("const getPulseAwareAgentContext");
    expect(pageSource).not.toContain("CreatePulseResolvedPreset");
    expect(pulsePageRuntimeSource).toContain("standardCreateAgentContextResolver: getAgentContext");
    expect(pulsePageRuntimeSource).toContain(
      "pulseCreateAgentContextResolver: getPulseAwareAgentContext"
    );
    expect(pulsePageRuntimeSource).not.toContain("createModeAgentContextResolver");
    expect(pulsePageRuntimeSource).toContain("clearPulseRuntimeForPage();");
    expect(pulsePageRuntimeSource).toContain("activeCreatePulsePresetSnapshot");
  });

  it("keeps the active Create composers mode-owned below the top-level switch", () => {
    const componentSourceFiles = collectSourceFiles(
      path.join(process.cwd(), "features", "ai-studio", "components")
    );
    const pageContentSource = readFrontendFile(
      "features/ai-studio/components/AiStudioPageContent.tsx"
    );
    const contractSource = readFrontendFile(
      "features/ai-studio/hooks/contracts/pageContentContracts.ts"
    );
    const standardComposerSource = readFrontendFile(
      "features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx"
    );
    const pulseComposerSource = readFrontendFile(
      "features/ai-studio/components/create/PulseCreatePropertiesPanel.tsx"
    );
    const standardPromptStepSource = readFrontendFile(
      "features/ai-studio/components/PromptStep.tsx"
    );
    const standardChatSurfaceSource = readFrontendFile(
      "features/ai-studio/components/promptStep/StandardPromptStepChatSurface.tsx"
    );
    const pulsePromptStepSource = readFrontendFile(
      "features/ai-studio/components/PulsePromptStep.tsx"
    );

    expect(pageContentSource).toContain("StandardCreatePropertiesPanel");
    expect(pageContentSource).toContain("PulseCreatePropertiesPanel");
    expect(pageContentSource).toContain('expertCreateMode === "pulse"');
    expect(pageContentSource).toContain('import("./create/PulseCreatePropertiesPanel")');
    expect(pageContentSource).not.toContain('from "./CreatePropertiesPanel"');
    expect(contractSource).not.toContain('from "../../components/CreatePropertiesPanel"');
    expect(
      componentSourceFiles.some((filePath) =>
        filePath.endsWith(`${path.sep}CreatePropertiesPanel.tsx`)
      )
    ).toBe(false);

    expect(standardComposerSource).not.toContain("PulseCreatePanelView");
    expect(standardComposerSource).not.toContain("PulseCreateChatPanel");
    expect(standardComposerSource).not.toContain("CreatePulsePreset");
    expect(standardComposerSource).not.toContain("AgentPulseWorkflowSession");
    expect(standardComposerSource).not.toContain("isPulseCreateMode");

    expect(pulseComposerSource).not.toContain("StandardCreatePanelView");
    expect(pulseComposerSource).not.toContain("StandardCreateChatPanel");
    expect(pulseComposerSource).not.toContain("StylesControl");
    expect(pulseComposerSource).not.toContain("AspectDropdown");
    expect(pulseComposerSource).not.toContain("ResolutionDropdown");
    expect(pulseComposerSource).not.toContain("onChatOffInlineGenerate");
    expect(pulseComposerSource).not.toContain("onGenerateFromAgentOutputPrompt");
    expect(pulseComposerSource).not.toContain("onAgentEnhanceSend");
    expect(pulseComposerSource).not.toContain("chatModeInlineGenerate:");
    expect(pulseComposerSource).not.toContain("outputGenerateCostCredits?:");

    expect(standardPromptStepSource).not.toContain("PulsePromptStepChatSurface");
    expect(standardPromptStepSource).toContain("StandardPromptStepChatSurface");
    expect(standardPromptStepSource).not.toContain("pulseLoadingState");
    expect(standardPromptStepSource).not.toContain("useFlowComposerLayout");
    expect(standardChatSurfaceSource).toContain("Standard PromptStep chat-mode surface");
    expect(standardChatSurfaceSource).not.toContain("PromptStepPulseLoadingState");
    expect(standardChatSurfaceSource).not.toContain("pulseLoadingState");
    expect(standardChatSurfaceSource).not.toContain("useFlowComposerLayout");
    expect(pulsePromptStepSource).toContain("PulsePromptStepChatSurface");
    expect(pulsePromptStepSource).not.toContain("onAgentEnhanceSend");
  });

  it("keeps Pulse loading presentation out of the shared panel prop builder", () => {
    const pageContractSource = readFrontendFile(
      "features/ai-studio/hooks/contracts/pageContentContracts.ts"
    );
    const panelPropBuilderSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioPanelProps.ts"
    );
    const standardCreatePanelPropsSource = readFrontendFile(
      "features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePanelProps.ts"
    );
    const pulseCreatePanelPropsSource = readFrontendFile(
      "features/ai-studio/hooks/pulseCreateRuntime/usePulseCreatePanelProps.ts"
    );
    const pulseComposerSource = readFrontendFile(
      "features/ai-studio/components/create/PulseCreatePropertiesPanel.tsx"
    );

    expect(panelPropBuilderSource).not.toContain("PromptStepPulseLoadingState");
    expect(panelPropBuilderSource).not.toContain("resolveCreatePulsePresetLabelById");
    expect(panelPropBuilderSource).not.toContain("pulseLoadingState");
    expect(panelPropBuilderSource).not.toContain("AgentPulseWorkflowSession");
    expect(panelPropBuilderSource).not.toContain("CreatePulsePresetId");
    expect(panelPropBuilderSource).not.toContain("CreatePulseResolvedPreset");
    expect(panelPropBuilderSource).not.toContain("activeCreatePulsePreset");
    expect(panelPropBuilderSource).not.toContain("onCreatePulsePresetStart");
    expect(panelPropBuilderSource).not.toContain("createModeRuntimeProps");
    expect(panelPropBuilderSource).not.toContain("\n  prompt: string;\n");
    expect(panelPropBuilderSource).toContain("standardPrompt: string;");
    expect(panelPropBuilderSource).toContain("pulsePrompt: string;");
    expect(panelPropBuilderSource).toContain("prompt: standardPrompt");
    expect(panelPropBuilderSource).toContain("pulsePrompt");
    expect(panelPropBuilderSource).toContain("buildStandardCreatePanelProps");
    expect(panelPropBuilderSource).toContain("buildPulseCreatePanelProps");
    expect(standardCreatePanelPropsSource).not.toContain("Pulse");
    expect(standardCreatePanelPropsSource).not.toContain("pulseWorkflowSession");
    expect(pulseCreatePanelPropsSource).not.toContain("Standard");
    expect(pulseCreatePanelPropsSource).not.toContain("onAgentEnhanceSend");
    expect(pulseCreatePanelPropsSource).not.toContain("onChatModeEnabledChange");
    expect(pulseCreatePanelPropsSource).not.toContain("onChatOffInlineGenerate");
    expect(pulseCreatePanelPropsSource).not.toContain("onGenerate: handlePrimarySubmit");
    expect(pulseCreatePanelPropsSource).not.toContain("handlePrimarySubmit");
    expect(pulseCreatePanelPropsSource).toContain(
      "onGeneratePulseArtifact: handlePulseCreatePrimarySubmit"
    );
    expect(pulseComposerSource).not.toContain("onGenerate: () => void");
    expect(pulseComposerSource).toContain("onGeneratePulseArtifact: () => void");
    expect(pulseComposerSource).not.toContain("prompt: string;");
    expect(pulseComposerSource).not.toContain("onPromptChange: (value: string) => void;");
    expect(pulseComposerSource).toContain("pulsePrompt: string;");
    expect(pulseComposerSource).toContain("onPulsePromptChange: (value: string) => void;");
    expect(pulseCreatePanelPropsSource).toContain("pulsePrompt");
    expect(pulseCreatePanelPropsSource).toContain("handlePulsePromptChange");
    expect(pageContractSource).toContain('expertCreateMode: "standard"');
    expect(pageContractSource).toContain("pulse?: never");
    expect(pageContractSource).toContain('expertCreateMode: "pulse"');
    expect(pageContractSource).toContain("standard?: never");
    expect(pulseComposerSource).toContain("PromptStepPulseLoadingState");
    expect(pulseComposerSource).toContain("resolveCreatePulsePresetLabelById");
    expect(pulseComposerSource).toContain("pulseLoadingState");
  });

  it("keeps shared generation submission from branching on Create mode", () => {
    const generationControllerSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioGenerationController.ts"
    );
    const outputGenerationBridgeSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioAgentOutputGenerationBridge.ts"
    );
    const standardPrimarySubmitSource = readFrontendFile(
      "features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts"
    );
    const standardInlineGenerateSource = readFrontendFile(
      "features/ai-studio/hooks/standardCreateRuntime/useStandardCreateInlineGenerate.ts"
    );
    const pulsePrimarySubmitSource = readFrontendFile(
      "features/ai-studio/hooks/pulseCreateRuntime/usePulseCreatePrimarySubmit.ts"
    );
    const panelPropBuilderSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioPanelProps.ts"
    );
    const stateRuntimeControllersSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioStateRuntimeControllers.ts"
    );
    const stateSource = readFrontendFile("features/ai-studio/hooks/useAiStudioState.ts");
    const outputControllersSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioStateOutputControllers.ts"
    );
    const pageDerivationsSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioPageDerivations.ts"
    );
    const sessionSnapshotControllerSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioSessionSnapshotController.ts"
    );
    const pageSource = readFrontendFile("pages/ai-studio.tsx");

    expect(generationControllerSource).not.toContain("expertCreateMode");
    expect(outputGenerationBridgeSource).not.toContain("expertCreateMode");
    expect(generationControllerSource).not.toContain("onAgentCaptureResult");
    expect(generationControllerSource).not.toContain("usesAgentLane");
    expect(generationControllerSource).not.toContain("handleAgentSend");
    expect(generationControllerSource).not.toContain("agentInput");
    expect(generationControllerSource).not.toContain("resolveChatOffCreatePrompt");
    expect(pageSource).not.toContain("resolveCreateAgentGenerationHandoff");
    expect(pageSource).toContain("handleStandardCreatePrimarySubmit");
    expect(pageSource).toContain("handlePulseCreatePrimarySubmit");
    expect(pageSource).not.toContain("const handlePrimarySubmit =");
    expect(pageSource).toContain("standardCreateCommands:");
    expect(pageSource).toContain("pulseCreateCommands:");
    expect(pageSource).toContain("handlePrimarySubmit: handleStandardCreatePrimarySubmit");
    expect(pageSource).toContain("handleGenerateArtifact: handlePulseCreatePrimarySubmit");
    expect(panelPropBuilderSource).toContain("standardCreateCommands:");
    expect(panelPropBuilderSource).toContain("pulseCreateCommands:");
    expect(pageSource).toContain("useStandardCreatePrimarySubmit");
    expect(pageSource).toContain("usePulseCreatePrimarySubmit");
    expect(pageSource).not.toContain("const pulsePrompt = resolveChatOffCreatePrompt");
    expect(pageSource).not.toContain("handleAgentSend(pulsePrompt");
    expect(pageSource).not.toContain("pulseArtifactPrompt ?? prompt.trim()");
    expect(pageSource).toContain("prompt: standardPrompt");
    expect(stateRuntimeControllersSource).not.toContain("\n  prompt: string;\n");
    expect(stateRuntimeControllersSource).not.toContain(
      'const activeCreatePrompt = expertCreateMode === "pulse" ? pulsePrompt : standardPrompt'
    );
    expect(stateRuntimeControllersSource).toContain("createRuntime:");
    expect(stateRuntimeControllersSource).toContain("createPrompts:");
    expect(stateRuntimeControllersSource).toContain("prompt: createRuntime.prompt");
    expect(stateSource).not.toContain(
      'const prompt = expertCreateMode === "pulse" ? pulsePrompt : standardPrompt'
    );
    expect(stateSource).toContain("const activeCreatePrompt = createStateRuntime.prompt");
    expect(outputControllersSource).not.toContain("\n  prompt: string;\n");
    expect(outputControllersSource).toContain("createPrompt: string;");
    expect(pageDerivationsSource).not.toContain("\n  prompt: string;\n");
    expect(pageDerivationsSource).toContain("createPrompt: string;");
    expect(sessionSnapshotControllerSource).not.toContain("\n  prompt: string;\n");
    expect(sessionSnapshotControllerSource).toContain(
      'pulseWorkspaceState.expertCreateMode === "pulse" ? pulseCreatePrompt : standardCreatePrompt'
    );
    expect(sessionSnapshotControllerSource).toContain("prompt: activeCreatePrompt");
    expect(pageSource).not.toContain(
      'expertCreateMode === "pulse" ? undefined : handleStandardAgentCaptureResult'
    );
    expect(pageSource).not.toContain('usesAgentLane: expertCreateMode === "pulse"');
    expect(standardPrimarySubmitSource).not.toContain("Pulse");
    expect(standardPrimarySubmitSource).not.toContain("pulseWorkflowSession");
    expect(standardPrimarySubmitSource).not.toContain("pulseCompletedArtifactPrompt");
    expect(standardPrimarySubmitSource).toContain("resolveChatOffCreatePrompt");
    expect(standardInlineGenerateSource).toContain("resolveChatOffCreatePrompt");
    expect(standardInlineGenerateSource).not.toContain("Pulse");
    expect(pulsePrimarySubmitSource).not.toContain("agentInput");
    expect(pulsePrimarySubmitSource).not.toContain("agentInput || prompt");
    expect(pulsePrimarySubmitSource).toContain("pulseCompletedArtifactPrompt");
    expect(pulsePrimarySubmitSource).toContain("suppressStyle: true");
  });

  it("keeps Pulse workflow helpers out of shared orchestration static imports", () => {
    const orchestrationSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioAgentOrchestration.ts"
    );
    const standardSendSource = readFrontendFile(
      "features/ai-studio/hooks/agentOrchestration/runStandardCreateAgentSend.ts"
    );
    const standardPromptEnhanceSource = readFrontendFile(
      "features/ai-studio/hooks/agentOrchestration/useStandardCreatePromptEnhance.ts"
    );
    const orchestrationRuntimeSource = readFrontendFile(
      "features/ai-studio/hooks/agentOrchestration/useCreateAgentOrchestrationRuntime.ts"
    );
    const pulsePresetStartRuntimeSource = readFrontendFile(
      "features/ai-studio/hooks/agentOrchestration/runPulsePresetStartRuntime.ts"
    );

    expect(orchestrationSource).not.toContain("import { startPulsePreset");
    expect(orchestrationSource).not.toContain(
      "import { buildPendingPulseWorkflowSessionForUserInput"
    );
    expect(orchestrationSource).not.toContain('from "../logic/pulseImageIntake"');
    expect(orchestrationSource).not.toContain("../logic/pulseImageIntake");
    expect(orchestrationSource).not.toContain("../logic/pulseWorkflowSession");
    expect(orchestrationSource).not.toContain("./agentOrchestration/pulseSendRuntime");
    expect(orchestrationSource).toContain(
      "./agentOrchestration/useCreateAgentOrchestrationRuntime"
    );
    expect(orchestrationSource).toContain("./agentOrchestration/runPulsePresetStartRuntime");
    expect(orchestrationSource).toContain("./agentOrchestration/runStandardCreateAgentSend");
    expect(orchestrationSource).toContain("./agentOrchestration/runPulseCreateAgentSend");
    expect(orchestrationSource).not.toContain("import { usePulsePresetStartRuntime");
    expect(orchestrationSource).not.toContain("usePulsePresetStartRuntime({");
    expect(orchestrationSource).toContain("runPulsePresetStartRuntime");
    expect(orchestrationSource).not.toContain("import { useStandardCreateAgentSend");
    expect(orchestrationSource).not.toContain("import { usePulseCreateAgentSend");
    expect(orchestrationSource).not.toContain("useStandardCreateAgentSend({");
    expect(orchestrationSource).not.toContain("usePulseCreateAgentSend({");
    expect(orchestrationSource).not.toContain("const handleStandardAgentSend");
    expect(orchestrationSource).not.toContain("const handlePulseAgentSend");
    expect(orchestrationSource).toContain("runStandardCreateAgentSend");
    expect(orchestrationSource).toContain("runPulseCreateAgentSend");
    expect(orchestrationSource).toContain("./agentOrchestration/useStandardCreatePromptEnhance");
    expect(orchestrationSource).toContain('runtimePolicy.kind === "standard"');
    expect(orchestrationSource).not.toContain("./agentOrchestration/pulsePresetStart");
    expect(orchestrationRuntimeSource).toContain("./pulseSendRuntime");
    expect(orchestrationRuntimeSource).not.toContain("./pulsePresetStart");
    expect(pulsePresetStartRuntimeSource).toContain("./pulsePresetStart");
    expect(standardSendSource).not.toContain("runtimePolicy");
    expect(standardSendSource).not.toContain("Pulse");
    expect(standardSendSource).not.toContain("WorkflowSession");
    expect(standardSendSource).not.toContain("pulseSendRuntime");
    expect(standardPromptEnhanceSource).not.toContain("runtimePolicy");
    expect(standardPromptEnhanceSource).not.toContain("Pulse");
    expect(standardPromptEnhanceSource).not.toContain("WorkflowSession");
    expect(standardPromptEnhanceSource).not.toContain("pulseSendRuntime");
  });

  it("keeps generic agent interactions free of mode branches", () => {
    const interactionsSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioAgentInteractions.ts"
    );

    expect(interactionsSource).not.toContain("expertCreateMode");
    expect(interactionsSource).not.toContain("clearPulseRuntime");
    expect(interactionsSource).toContain("clearActiveRuntime");
  });

  it("keeps the retired right-rail Agent Chat out of the AI Studio shell", () => {
    const pageSource = readFrontendFile("pages/ai-studio.tsx");
    const pageContentSource = readFrontendFile(
      "features/ai-studio/components/AiStudioPageContent.tsx"
    );
    const shellFrameSource = readFrontendFile(
      "features/ai-studio/components/AiStudioShellFrame.tsx"
    );

    expect(pageSource).not.toContain("const agentChat");
    expect(pageSource).not.toContain("agentChat={");
    expect(pageContentSource).not.toContain("agentChat:");
    expect(pageContentSource).not.toContain("agentChat={");
    expect(shellFrameSource).not.toContain("AgentChatPanel");
    expect(shellFrameSource).not.toContain("Agent Chat");
  });

  it("keeps the retired expanded-chat control out of Create composer contracts", () => {
    const createSourceFiles = [
      "features/ai-studio/hooks/useAiStudioPanelProps.ts",
      "features/ai-studio/components/create/StandardCreatePropertiesPanel.tsx",
      "features/ai-studio/components/create/PulseCreatePropertiesPanel.tsx",
      "features/ai-studio/components/PromptStep.tsx",
      "features/ai-studio/components/PulsePromptStep.tsx",
      "features/ai-studio/components/promptStep/types.ts",
      "features/ai-studio/components/promptStep/StandardPromptStepChatSurface.tsx",
      "features/ai-studio/components/promptStep/PulsePromptStepChatSurface.tsx",
    ];

    for (const relativePath of createSourceFiles) {
      const source = readFrontendFile(relativePath);
      expect(source).not.toContain("onExpandChat");
      expect(source).not.toContain("agentChatOpen");
      expect(source).not.toContain("prompt-expand-btn");
    }
  });

  it("keeps Standard chat-mode preference ownership out of the shared bridge", () => {
    const pageSource = readFrontendFile("pages/ai-studio.tsx");
    const bridgeSource = readFrontendFile("features/ai-studio/hooks/useAiStudioAgentBridge.ts");
    const standardChatModeSource = readFrontendFile(
      "features/ai-studio/hooks/standardCreateRuntime/useStandardCreateChatMode.ts"
    );

    expect(pageSource).toContain("useStandardCreateChatMode");
    expect(pageSource).toContain("standardChatModeEnabled");
    expect(pageSource).toContain("setStandardChatModeEnabled");
    expect(bridgeSource).not.toContain("readChatModeFromStorage");
    expect(bridgeSource).not.toContain("writeChatModeToStorage");
    expect(standardChatModeSource).toContain("readChatModeFromStorage");
    expect(standardChatModeSource).toContain("writeChatModeToStorage");
  });

  it("keeps page persistence from accepting loose active agent fields", () => {
    const pageSource = readFrontendFile("pages/ai-studio.tsx");
    const pagePersistenceSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioPageSessionPersistence.ts"
    );

    expect(pagePersistenceSource).toContain("type StandardCreatePersistenceRuntime");
    expect(pagePersistenceSource).toContain("type PulseCreatePersistenceRuntime");
    expect(pagePersistenceSource).toContain("createPersistenceRuntime: CreatePersistenceRuntime");
    expect(pagePersistenceSource).not.toContain("agentMessages: AgentMessage[]");
    expect(pagePersistenceSource).not.toContain("agentInput: string");
    expect(pagePersistenceSource).not.toContain("latestAgentPrompt: string | null");
    expect(pagePersistenceSource).not.toContain("pulseWorkflowSession?: AgentPulseWorkflowSession");
    expect(pagePersistenceSource).not.toContain('expertCreateMode: "standard" | "pulse"');
    expect(pagePersistenceSource).not.toContain("activeAgentRuntimes");
    expect(pageSource).toContain("const createPersistenceRuntime = useMemo");
    expect(pageSource).toContain("createPersistenceRuntime,");
    expect(pageSource).toContain('kind: "standard"');
    expect(pageSource).toContain('kind: "pulse"');
    expect(pageSource).not.toContain(
      'agentRuntimes: expertCreateMode === "pulse" ? sessionAgentRuntimes : undefined'
    );
  });

  it("keeps Pulse hydration from using runtime metadata as workspace authority", () => {
    const hydratorSource = readFrontendFile("features/ai-studio/logic/sessionSnapshotHydrator.ts");

    expect(hydratorSource).not.toContain(
      "workspaceActivePulsePresetId || hydratedAgentRuntimes.pulsePresetId"
    );
    expect(hydratorSource).toContain("pulsePresetId: hydratedPulsePresetId");
  });

  it("keeps page-content Create test fixtures discriminated by mode", () => {
    const pageContentDropTestSource = readFrontendFile(
      "features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx"
    );

    expect(pageContentDropTestSource).not.toContain("commonCreateFields");
    expect(pageContentDropTestSource).not.toContain("Record<string, unknown>");
    expect(pageContentDropTestSource).toContain("type CreatePropertiesTestParams");
    expect(pageContentDropTestSource).toContain("standard?: Partial<TestStandardCreateProps>");
    expect(pageContentDropTestSource).toContain("pulse?: Partial<TestPulseCreateProps>");
  });

  it("keeps Standard and Pulse Create props from cloning one shared prop bag", () => {
    const pageSource = readFrontendFile("pages/ai-studio.tsx");
    const panelPropBuilderSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioPanelProps.ts"
    );

    expect(pageSource).not.toContain("...panelProps.propertiesCreate,");
    expect(pageSource).toContain("activeCreateProperties.standard");
    expect(pageSource).toContain("activeCreateProperties.pulse");
    expect(pageSource).not.toContain(
      "...panelProps.propertiesCreate.standard,\n      expertCreateMode"
    );
    expect(pageSource).not.toContain(
      "...panelProps.propertiesCreate.pulse,\n      expertCreateMode"
    );
    expect(pageSource).not.toContain(
      "...panelProps.propertiesCreate.pulse,\n      onExpertCreateModeChange"
    );
    expect(panelPropBuilderSource).toContain('expertCreateMode === "pulse"');
    expect(panelPropBuilderSource).toContain("pulse: buildPulseCreatePanelProps");
    expect(panelPropBuilderSource).toContain("standard: buildStandardCreatePanelProps");
  });
});
