import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
  it("removes generic and compatibility Create agent hook wrappers", () => {
    const removedFiles = [
      "features/ai-agent/useAiAgent.ts",
      "features/ai-agent/useStandardCreateAgent.ts",
      "features/ai-agent/usePulseCreateAgent.ts",
      "features/ai-agent/useAiAgentTypes.ts",
      "features/ai-agent/legacy/useAiAgentCompat.ts",
    ];
    const packageSource = readFrontendFile("package.json");

    for (const relativePath of removedFiles) {
      expect(existsSync(path.join(process.cwd(), relativePath))).toBe(false);
      expect(packageSource).not.toContain(relativePath);
    }
  });

  it("keeps generic client transport helpers out of mode selection and workflow parsing", () => {
    const transportSource = readFrontendFile("features/ai-agent/client/studioAgentTransport.ts");

    expect(transportSource).not.toContain("sendStudioAgentTurn =");
    expect(transportSource).not.toContain('runtimeMode === "pulse"');
    expect(
      existsSync(path.join(process.cwd(), "features/ai-agent/client/transportResultResolution.ts"))
    ).toBe(false);
  });

  it("keeps the retired shared expert panel out of source", () => {
    const sourceFiles = collectSourceFiles(path.join(process.cwd(), "features", "ai-studio"));
    const sourceReferences = sourceFiles.filter((filePath) =>
      readFileSync(filePath, "utf8").includes("ExpertCreatePanelView")
    );

    expect(sourceReferences).toEqual([]);
  });

  it("keeps removed compatibility agent surfaces out of production imports", () => {
    const frontendRoot = process.cwd();
    const sourceFiles = [
      ...collectSourceFiles(path.join(frontendRoot, "features")),
      ...collectSourceFiles(path.join(frontendRoot, "pages")),
    ];
    const productionImporters = sourceFiles.filter((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return (
        source.includes("useAiAgent") ||
        source.includes("legacy/useAiAgentCompat") ||
        source.includes("useAiStudioAgentBridge") ||
        source.includes("useCreateAgentBridgeActiveAgent") ||
        source.includes("createAgentBridgeRuntime") ||
        source.includes("createAgentBridgePersistenceRuntime")
      );
    });

    expect(productionImporters).toEqual([]);
  });

  it("removes the legacy Create bridge runtime", () => {
    const removedFiles = [
      "features/ai-studio/hooks/useAiStudioAgentBridge.ts",
      "features/ai-studio/hooks/agentBridgeRuntime/createAgentBridgeRuntime.ts",
      "features/ai-studio/hooks/agentBridgeRuntime/createAgentBridgePersistenceRuntime.ts",
      "features/ai-studio/hooks/agentBridgeRuntime/useCreateAgentBridgeActiveAgent.ts",
    ];
    const packageSource = readFrontendFile("package.json");
    const standardRuntimeBindingSource = readFrontendFile(
      "features/ai-studio/hooks/createAgentRuntime/standardCreateAgentRuntimeBinding.ts"
    );
    const orchestrationPolicySource = readFrontendFile(
      "features/ai-studio/hooks/agentOrchestration/createAgentOrchestrationRuntimePolicy.ts"
    );

    for (const relativePath of removedFiles) {
      expect(existsSync(path.join(process.cwd(), relativePath))).toBe(false);
      expect(packageSource).not.toContain(relativePath);
    }
    expect(orchestrationPolicySource).not.toContain("pulseSessionState");
    expect(standardRuntimeBindingSource).not.toContain("workflowSession");
    expect(standardRuntimeBindingSource).not.toContain("Pulse");
  });

  it("keeps custom Pulse preference loading out of page-root Create state", () => {
    const pageSource = readFrontendFile("pages/ai-studio.tsx");

    expect(pageSource).not.toContain("useCreatePulsePresetPanelPreference");
    expect(pageSource).not.toContain("CreatePulsePreferenceProvider");
    expect(pageSource).not.toContain("CreatePulsePreferenceRuntime");
    expect(pageSource).not.toContain("savedCreatePulsePresets");
    expect(pageSource).not.toContain("selectedCreatePulsePresetIds");
    expect(
      existsSync(path.join(process.cwd(), "features/ai-studio/hooks/useAiStudioPanelProps.ts"))
    ).toBe(false);
  });

  it("keeps mode-owned Create runtime result builders from accepting the opposite mode", () => {
    const standardRuntimeBuilder = readFrontendFile(
      "features/ai-studio/createRuntime/buildStandardCreateRuntimeResult.ts"
    );
    const pulseRuntimeBuilder = readFrontendFile(
      "features/ai-studio/createRuntime/buildPulseCreateRuntimeResult.ts"
    );

    expect(standardRuntimeBuilder).not.toContain("PulseCreate");
    expect(standardRuntimeBuilder).not.toContain("pulsePrompt");
    expect(standardRuntimeBuilder).not.toContain("workflowSession");
    expect(standardRuntimeBuilder).not.toContain("activePreset");
    expect(pulseRuntimeBuilder).not.toContain("StandardCreate");
    expect(pulseRuntimeBuilder).not.toContain("chatModeEnabled");
    expect(pulseRuntimeBuilder).not.toContain("handleChatOffInlineGenerate");
  });

  it("keeps the Standard Create agent runtime statically Standard-only", () => {
    const standardAgentRuntime = readFrontendFile(
      "features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts"
    );

    expect(standardAgentRuntime).toContain("standardCreateAgentRuntimeBinding");
    expect(standardAgentRuntime).toContain('requestRuntimeMode: "standard"');
    expect(standardAgentRuntime).toContain("runStandardCreateAgentSend");
    expect(standardAgentRuntime).toContain("linkedPromptReferenceIds");
    expect(standardAgentRuntime).not.toContain("Pulse");
    expect(standardAgentRuntime).not.toContain("pulse");
    expect(standardAgentRuntime).not.toContain("useCreateAgentBridgeActiveAgent");
    expect(standardAgentRuntime).not.toContain("useAiStudioAgentOrchestration");
    expect(standardAgentRuntime).not.toContain("pulseCreateAgentRuntimeBinding");
    expect(standardAgentRuntime).not.toContain("workflowSession");
  });

  it("keeps the Pulse Create agent runtime statically Pulse-only", () => {
    const pulseAgentRuntime = readFrontendFile(
      "features/ai-studio/createRuntime/usePulseCreateAgentRuntime.ts"
    );

    expect(pulseAgentRuntime).toContain("pulseCreateAgentRuntimeBinding");
    expect(pulseAgentRuntime).toContain('requestRuntimeMode: "pulse"');
    expect(pulseAgentRuntime).toContain("runPulseCreateAgentSend");
    expect(pulseAgentRuntime).toContain("runPulsePresetStartRuntime");
    expect(pulseAgentRuntime).toContain("restartCreatePulsePreset");
    expect(pulseAgentRuntime).toContain("linkedPromptReferenceIds");
    expect(pulseAgentRuntime).not.toContain("Standard");
    expect(pulseAgentRuntime).not.toContain("standard");
    expect(pulseAgentRuntime).not.toContain("useCreateAgentBridgeActiveAgent");
    expect(pulseAgentRuntime).not.toContain("useAiStudioAgentOrchestration");
    expect(pulseAgentRuntime).not.toContain("standardCreateAgentRuntimeBinding");
    expect(pulseAgentRuntime).not.toContain("onChatModeChange");
    expect(pulseAgentRuntime).not.toContain("setChatModeEnabled");
  });

  it("keeps Pulse workflow implementation helpers out of page-root static imports", () => {
    const pageSource = readFrontendFile("pages/ai-studio.tsx");
    const pulseReconciliationSource = readFrontendFile(
      "features/ai-studio/hooks/createPulsePageRuntime/usePulseWorkflowSessionReconciliation.ts"
    );

    expect(pageSource).not.toContain("isCreatePulseBuiltInPresetId");
    expect(pageSource).not.toContain('from "../features/ai-studio/logic/pulseWorkflowSession"');
    expect(pageSource).not.toContain('import("../features/ai-studio/logic/pulseWorkflowSession")');
    expect(pageSource).not.toContain("usePulseWorkflowSessionReconciliation");
    expect(pulseReconciliationSource).toContain('import("../../logic/pulseWorkflowSession")');
  });

  it("keeps Standard page context handoff on the neutral context resolver", () => {
    const pageSource = readFrontendFile("features/ai-studio/routes/AiStudioRouteApp.tsx");
    const pulsePageRuntimeSource = readFrontendFile(
      "features/ai-studio/hooks/createPulsePageRuntime/useCreatePulsePresetPageRuntime.ts"
    );

    expect(pageSource).toContain("useCreatePulsePresetPageRuntime");
    expect(pulsePageRuntimeSource).toContain("standardCreateAgentContextResolver");
    expect(pulsePageRuntimeSource).toContain("pulseCreateAgentContextResolver");
    expect(pageSource).toContain("return <CreateRuntimeRoot base={base} />;");
    expect(pageSource).toContain("const CreateRuntimeRoot =");
    expect(pageSource).toContain("const CreateAgentRuntimeHost =");
    expect(pageSource).toContain("const AiStudioPageRuntimeBody =");
    expect(pageSource).toContain("useAiStudioPageProjectSessionRuntime");
    expect(pageSource).toContain(
      'base.expertCreateMode === "pulse" ? pulseCreateAgentRuntime : standardCreateAgentRuntime'
    );
    expect(pageSource).toContain("key={projectScopeKey}");
    expect(pageSource).toContain("base={base}");
    expect(pageSource).toContain("createPulsePageRuntime={createPulsePageRuntime}");
    expect(pageSource).toContain("getAgentContext: base.getAgentContext");
    expect(pageSource).toContain(
      "getAgentContext: createPulsePageRuntime.pulseCreateAgentContextResolver"
    );
    expect(pageSource).toContain("setStandardCreatePrompt: base.setStandardCreatePrompt");
    expect(pageSource).toContain("setPulseCreatePrompt: base.setPulseCreatePrompt");
    expect(pageSource).toContain("const activeCreateAgentRuntime =");
    expect(pageSource).toContain("activeCreateAgentRuntime={activeCreateAgentRuntime}");
    expect(pageSource).not.toContain("setSharedPrompt: base.setSharedPrompt");
    expect(pageSource).toContain("setCreatePromptForActiveMode");
    expect(pageSource).not.toContain("\n    setSharedPrompt,\n");
    expect(pageSource).toContain("const createPulsePageRuntime = useCreatePulsePresetPageRuntime");
    expect(pageSource).not.toContain("base.standardCreateAgentContextResolver");
    expect(pageSource).not.toContain("base.pulseCreateAgentContextResolver");
    expect(pageSource).not.toContain("useAiStudioAgentBridge");
    expect(pageSource).not.toContain("const createAgentBridgeRuntime = useMemo");
    expect(pageSource).not.toContain("createAgentRuntime: createAgentBridgeRuntime");
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
    expect(pulsePageRuntimeSource).toContain("clearPulsePrompt();");
    expect(pulsePageRuntimeSource).toContain("activeCreatePulsePresetSnapshot");

    const createRootIndex = pageSource.indexOf("const CreateRuntimeRoot =");
    const runtimeBodyIndex = pageSource.indexOf("const AiStudioPageRuntimeBody =");
    const standardRuntimeCallIndex = pageSource.indexOf("useStandardCreateAgentRuntime({");
    const pulsePageRuntimeCallIndex = pageSource.indexOf("useCreatePulsePresetPageRuntime({");
    const pulseRuntimeCallIndex = pageSource.indexOf("usePulseCreateAgentRuntime({");

    expect(pulsePageRuntimeCallIndex).toBeGreaterThan(createRootIndex);
    expect(pulsePageRuntimeCallIndex).toBeLessThan(standardRuntimeCallIndex);
    expect(standardRuntimeCallIndex).toBeGreaterThan(createRootIndex);
    expect(standardRuntimeCallIndex).toBeLessThan(pulseRuntimeCallIndex);
    expect(pulseRuntimeCallIndex).toBeGreaterThan(createRootIndex);
    expect(pulsePageRuntimeCallIndex).toBeLessThan(runtimeBodyIndex);
    expect(pulseRuntimeCallIndex).toBeLessThan(runtimeBodyIndex);
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
    expect(pageContentSource).toContain('key="standard-create-runtime"');
    expect(pageContentSource).toContain('key="pulse-create-runtime"');
    expect(pageContentSource).toContain('expertCreateMode === "pulse"');
    expect(pageContentSource).toContain('from "./create/PulseCreatePropertiesPanel"');
    expect(pageContentSource).not.toContain('import("./create/PulseCreatePropertiesPanel")');
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

  it("keeps Pulse loading presentation out of shared Create contracts", () => {
    const pageContractSource = readFrontendFile(
      "features/ai-studio/hooks/contracts/pageContentContracts.ts"
    );
    const editPanelPropsSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioEditExpertPanelProps.ts"
    );
    const videoPanelPropsSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioVideoPanelProps.ts"
    );
    const standardCreatePanelPropsSource = readFrontendFile(
      "features/ai-studio/createRuntime/standardPanel/standardCreatePanelContract.ts"
    );
    const pulseCreatePanelPropsSource = readFrontendFile(
      "features/ai-studio/hooks/pulseCreateRuntime/usePulseCreatePanelProps.ts"
    );
    const pulseComposerSource = readFrontendFile(
      "features/ai-studio/components/create/PulseCreatePropertiesPanel.tsx"
    );

    expect(
      existsSync(path.join(process.cwd(), "features/ai-studio/hooks/useAiStudioPanelProps.ts"))
    ).toBe(false);
    expect(editPanelPropsSource).not.toContain("PromptStepPulseLoadingState");
    expect(editPanelPropsSource).not.toContain("resolveCreatePulsePresetLabelById");
    expect(editPanelPropsSource).not.toContain("pulseLoadingState");
    expect(editPanelPropsSource).not.toContain("AgentPulseWorkflowSession");
    expect(editPanelPropsSource).not.toContain("CreatePulsePresetId");
    expect(editPanelPropsSource).not.toContain("CreatePulseResolvedPreset");
    expect(editPanelPropsSource).not.toContain("activeCreatePulsePreset");
    expect(editPanelPropsSource).not.toContain("onCreatePulsePresetStart");
    expect(videoPanelPropsSource).not.toContain("PromptStepPulseLoadingState");
    expect(videoPanelPropsSource).not.toContain("resolveCreatePulsePresetLabelById");
    expect(videoPanelPropsSource).not.toContain("pulseLoadingState");
    expect(videoPanelPropsSource).not.toContain("AgentPulseWorkflowSession");
    expect(videoPanelPropsSource).not.toContain("CreatePulsePresetId");
    expect(videoPanelPropsSource).not.toContain("CreatePulseResolvedPreset");
    expect(videoPanelPropsSource).not.toContain("activeCreatePulsePreset");
    expect(videoPanelPropsSource).not.toContain("onCreatePulsePresetStart");
    expect(editPanelPropsSource).not.toContain("createModeRuntimeProps");
    expect(editPanelPropsSource).not.toContain("standardPrompt: string;");
    expect(editPanelPropsSource).not.toContain("pulsePrompt: string;");
    expect(editPanelPropsSource).not.toContain("handleStandardPromptChange");
    expect(editPanelPropsSource).not.toContain("handlePulsePromptChange");
    expect(videoPanelPropsSource).not.toContain("createModeRuntimeProps");
    expect(videoPanelPropsSource).not.toContain("standardPrompt: string;");
    expect(videoPanelPropsSource).not.toContain("pulsePrompt: string;");
    expect(videoPanelPropsSource).not.toContain("handleStandardPromptChange");
    expect(videoPanelPropsSource).not.toContain("handlePulsePromptChange");
    expect(standardCreatePanelPropsSource).not.toContain("PromptStepPulseLoadingState");
    expect(standardCreatePanelPropsSource).not.toContain("CreatePulsePresetId");
    expect(standardCreatePanelPropsSource).not.toContain("activeCreatePulsePreset");
    expect(standardCreatePanelPropsSource).not.toContain("pulseWorkflowSession");
    expect(standardCreatePanelPropsSource).not.toContain("onAgentEnhanceSend");
    expect(pulseCreatePanelPropsSource).not.toContain("Standard");
    expect(pulseCreatePanelPropsSource).not.toContain("onAgentEnhanceSend");
    expect(pulseCreatePanelPropsSource).not.toContain("onChatModeEnabledChange");
    expect(pulseCreatePanelPropsSource).not.toContain("onChatOffInlineGenerate");
    expect(pulseCreatePanelPropsSource).not.toContain("onGenerate: handlePrimarySubmit");
    expect(pulseCreatePanelPropsSource).not.toContain("handlePrimarySubmit");
    expect(pulseComposerSource).not.toContain("onGenerate: () => void");
    expect(pulseComposerSource).not.toContain("onGeneratePulseArtifact: () => void");
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
    const pageSource = readFrontendFile("features/ai-studio/routes/AiStudioRouteApp.tsx");
    const createPanelRuntimeSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioCreatePanelRuntime.ts"
    );

    expect(generationControllerSource).not.toContain("expertCreateMode");
    expect(outputGenerationBridgeSource).not.toContain("expertCreateMode");
    expect(generationControllerSource).not.toContain("onAgentCaptureResult");
    expect(generationControllerSource).not.toContain("usesAgentLane");
    expect(generationControllerSource).not.toContain("handleAgentSend");
    expect(generationControllerSource).not.toContain("agentInput");
    expect(generationControllerSource).not.toContain("resolveChatOffCreatePrompt");
    expect(generationControllerSource).not.toContain("handlePrimarySubmit");
    expect(outputGenerationBridgeSource).toContain("enabled?: boolean");
    expect(outputGenerationBridgeSource).toContain("if (!enabled) return;");
    expect(outputGenerationBridgeSource).toContain("assistantBubbleMedia: enabled");
    expect(pageSource).not.toContain("resolveCreateAgentGenerationHandoff");
    expect(createPanelRuntimeSource).toContain("handleStandardCreatePrimarySubmit");
    expect(createPanelRuntimeSource).not.toContain("handlePulseCreatePrimarySubmit");
    expect(pageSource).toContain("<AiStudioPageRuntimeBody");
    expect(pageSource).toContain("const AiStudioPageRuntimeBody =");
    expect(pageSource).not.toContain("<StandardCreateGenerationCommandRoot shell={shell} />");
    expect(pageSource).not.toContain("<PulseCreateGenerationCommandRoot shell={shell} />");
    expect(pageSource).not.toContain("const StandardCreateGenerationCommandRoot =");
    expect(pageSource).not.toContain("const PulseCreateGenerationCommandRoot =");
    expect(pageSource).toContain("const AiStudioPageRuntimeBody =");
    expect(pageSource).toContain('activeCreateAgentRuntime.kind === "pulse"');
    expect(createPanelRuntimeSource).toContain("useAiStudioAgentOutputGenerationBridge({");
    expect(createPanelRuntimeSource).not.toContain('enabled: expertCreateMode === "standard"');
    expect(createPanelRuntimeSource).not.toContain('enabled: expertCreateMode === "pulse"');
    expect(createPanelRuntimeSource).not.toContain("const handlePrimarySubmit =");
    expect(createPanelRuntimeSource).not.toContain("standardCreateCommands:");
    expect(createPanelRuntimeSource).not.toContain("pulseCreateCommands:");
    expect(createPanelRuntimeSource).toContain(
      "onPrimarySubmit: handleStandardCreatePrimarySubmit"
    );
    expect(createPanelRuntimeSource).not.toContain("onGenerateArtifact:");
    expect(pageSource).not.toContain("useAiStudioPanelProps");
    expect(createPanelRuntimeSource).toContain("useStandardCreatePrimarySubmit");
    expect(createPanelRuntimeSource).not.toContain("usePulseCreatePrimarySubmit");
    expect(pageSource).not.toContain("useStandardCreateInlineGenerate");
    const presenterIndex = pageSource.indexOf("<AiStudioPageShell");
    const runtimeSelectorIndex = pageSource.indexOf('activeCreateAgentRuntime.kind === "pulse"');
    const standardPrimarySubmitIndex = createPanelRuntimeSource.indexOf(
      "useStandardCreatePrimarySubmit({"
    );

    expect(runtimeSelectorIndex).toBeGreaterThanOrEqual(0);
    expect(runtimeSelectorIndex).toBeLessThan(presenterIndex);
    expect(standardPrimarySubmitIndex).toBeGreaterThanOrEqual(0);
    expect(standardPrimarySubmitIndex).toBeLessThan(presenterIndex);
    expect(createPanelRuntimeSource).toContain("useAiStudioAgentOutputGenerationBridge({");
    expect(createPanelRuntimeSource).not.toContain(
      "const pulsePrompt = resolveChatOffCreatePrompt"
    );
    expect(createPanelRuntimeSource).not.toContain("handleAgentSend(pulsePrompt");
    expect(createPanelRuntimeSource).not.toContain("pulseArtifactPrompt ?? prompt.trim()");
    expect(createPanelRuntimeSource).toContain("prompt: standardPrompt");
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
    expect(stateSource).toContain("const {\n    activeCreatePrompt,");
    expect(stateSource).toContain("createStateRuntime,");
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
    expect(standardPrimarySubmitSource).not.toContain("resolveChatOffCreatePrompt");
    expect(standardPrimarySubmitSource).toContain("resolveStandardCreatePrimaryActionDecision");
  });

  it("keeps Pulse workflow helpers out of shared orchestration static imports", () => {
    const orchestrationSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioAgentOrchestration.ts"
    );
    const standardSendSource = readFrontendFile(
      "features/ai-studio/hooks/agentOrchestration/runStandardCreateAgentSend.ts"
    );
    const pulseSendSource = readFrontendFile(
      "features/ai-studio/hooks/agentOrchestration/runPulseCreateAgentSend.ts"
    );
    const pulsePresetStartRuntimeSource = readFrontendFile(
      "features/ai-studio/hooks/agentOrchestration/runPulsePresetStartRuntime.ts"
    );
    const standardPromptEnhancePath = path.join(
      process.cwd(),
      "features",
      "ai-studio",
      "hooks",
      "agentOrchestration",
      "useStandardCreatePromptEnhance.ts"
    );
    const describeReferencePath = path.join(
      process.cwd(),
      "features",
      "ai-studio",
      "hooks",
      "agentOrchestration",
      "describeReference.ts"
    );
    const orchestrationRuntimeAdapterPath = path.join(
      process.cwd(),
      "features",
      "ai-studio",
      "hooks",
      "agentOrchestration",
      "useCreateAgentOrchestrationRuntime.ts"
    );

    expect(orchestrationSource).not.toContain("import { startPulsePreset");
    expect(orchestrationSource).not.toContain(
      "import { buildPendingPulseWorkflowSessionForUserInput"
    );
    expect(orchestrationSource).not.toContain('from "../logic/pulseImageIntake"');
    expect(orchestrationSource).not.toContain("../logic/pulseImageIntake");
    expect(orchestrationSource).not.toContain("../logic/pulseWorkflowSession");
    expect(orchestrationSource).not.toContain("./agentOrchestration/pulseSendRuntime");
    expect(orchestrationSource).not.toContain(
      "./agentOrchestration/useCreateAgentOrchestrationRuntime"
    );
    expect(existsSync(orchestrationRuntimeAdapterPath)).toBe(false);
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
    expect(orchestrationSource).not.toContain(
      "./agentOrchestration/useStandardCreatePromptEnhance"
    );
    expect(existsSync(standardPromptEnhancePath)).toBe(false);
    expect(existsSync(describeReferencePath)).toBe(false);
    expect(orchestrationSource).toContain('runtimePolicy.kind === "standard"');
    expect(orchestrationSource).not.toContain("./agentOrchestration/pulsePresetStart");
    expect(pulsePresetStartRuntimeSource).toContain("./pulsePresetStart");
    expect(standardSendSource).not.toContain("runtimePolicy");
    expect(standardSendSource).not.toContain("Pulse");
    expect(standardSendSource).not.toContain("WorkflowSession");
    expect(standardSendSource).not.toContain("pulseSendRuntime");
    expect(pulseSendSource).not.toContain("previousPrompt: latestAgentPrompt");
    expect(pulseSendSource).not.toContain("baseContext.activePrompt = latestAgentPrompt");
    expect(pulseSendSource).toContain("stripGenericPromptContinuity");
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
      "features/ai-studio/createRuntime/buildStandardCreateRuntimeResult.ts",
      "features/ai-studio/createRuntime/buildPulseCreateRuntimeResult.ts",
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

  it("keeps retired expanded-chat state out of active Create agent helpers", () => {
    const interactionsSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioAgentInteractions.ts"
    );

    for (const source of [interactionsSource]) {
      expect(source).not.toContain("isAgentChatOpen");
      expect(source).not.toContain("setIsAgentChatOpen");
      expect(source).not.toContain("handleExpandChat");
      expect(source).not.toContain("handleCloseAgentChat");
      expect(source).not.toContain("handleAgentAddToGrid");
    }
  });

  it("keeps Standard chat-off preference storage out of active Create", () => {
    const pageSource = readFrontendFile("pages/ai-studio.tsx");
    const standardRuntimeSource = readFrontendFile(
      "features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts"
    );
    const standardChatModeHookName = ["useStandard", "CreateChatMode"].join("");
    const standardChatModePath = path.join(
      process.cwd(),
      `features/ai-studio/hooks/standardCreateRuntime/${standardChatModeHookName}.ts`
    );

    expect(pageSource).not.toContain(standardChatModeHookName);
    expect(pageSource).not.toContain("standardChatModeEnabled");
    expect(pageSource).not.toContain("setStandardChatModeEnabled");
    expect(standardRuntimeSource).not.toContain(standardChatModeHookName);
    expect(standardRuntimeSource).not.toContain("standardChatModeEnabled");
    expect(standardRuntimeSource).not.toContain("setStandardChatModeEnabled");
    expect(existsSync(standardChatModePath)).toBe(false);
  });

  it("keeps page persistence from accepting loose active agent fields", () => {
    const pageSource = readFrontendFile("features/ai-studio/routes/AiStudioRouteApp.tsx");
    const pagePersistenceSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioPageSessionPersistence.ts"
    );
    const pageProjectSessionRuntimeSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioPageProjectSessionRuntime.ts"
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
    expect(pageSource).toContain("useAiStudioPageProjectSessionRuntime({");
    expect(pageSource).toContain("activeCreateAgentKind: activeCreateAgentRuntime.kind");
    expect(pageProjectSessionRuntimeSource).toContain('kind: "standard"');
    expect(pageProjectSessionRuntimeSource).toContain('kind: "pulse"');
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
    const standardCreateTestSource = readFrontendFile(
      "features/ai-studio/components/create/__tests__/StandardCreatePropertiesPanel.single-mode.test.tsx"
    );
    const pulseCreateTestSource = readFrontendFile(
      "features/ai-studio/components/create/__tests__/PulseCreatePropertiesPanel.test.tsx"
    );

    expect(standardCreateTestSource).toContain("StandardCreatePropertiesPanel single mode");
    expect(standardCreateTestSource).toContain('"text-image"');
    expect(standardCreateTestSource).not.toContain("PulseCreatePropertiesPanel");
    expect(pulseCreateTestSource).toContain('describe("PulseCreatePropertiesPanel"');
    expect(pulseCreateTestSource).toContain("omits helper startup messaging");
    expect(pulseCreateTestSource).not.toContain("StandardCreatePropertiesPanel");
  });

  it("keeps Standard and Pulse Create props from cloning one shared prop bag", () => {
    const pageSource = readFrontendFile("features/ai-studio/routes/AiStudioRouteApp.tsx");
    const createPanelRuntimeSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioCreatePanelRuntime.ts"
    );
    const editVideoPanelRuntimeSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioEditVideoPanelRuntimes.ts"
    );

    expect(
      existsSync(path.join(process.cwd(), "features/ai-studio/hooks/useAiStudioPanelProps.ts"))
    ).toBe(false);
    expect(pageSource).not.toContain("...panelProps.propertiesCreate,");
    expect(pageSource).not.toContain("useAiStudioPanelProps");
    expect(pageSource).not.toContain("useAiStudioEditVideoPanelProps");
    expect(editVideoPanelRuntimeSource).toContain("useAiStudioEditExpertPanelProps");
    expect(editVideoPanelRuntimeSource).toContain("useAiStudioVideoPanelProps");
    expect(createPanelRuntimeSource).toContain("buildStandardCreateRuntimeResult");
    expect(createPanelRuntimeSource).toContain("buildPulseCreateRuntimeResult");
    expect(pageSource).toContain("propertiesCreate: pagePropertiesCreate");
    expect(pageSource).not.toContain("activeCreateProperties.standard");
    expect(pageSource).not.toContain("activeCreateProperties.pulse");
    expect(createPanelRuntimeSource).not.toContain(
      "...panelProps.propertiesCreate.standard,\n      expertCreateMode"
    );
    expect(createPanelRuntimeSource).not.toContain(
      "...panelProps.propertiesCreate.pulse,\n      expertCreateMode"
    );
    expect(createPanelRuntimeSource).not.toContain(
      "...panelProps.propertiesCreate.pulse,\n      onExpertCreateModeChange"
    );
  });
});
