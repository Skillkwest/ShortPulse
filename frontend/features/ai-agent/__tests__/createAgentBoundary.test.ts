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

    expect(source).not.toContain("pulseTransportResultResolution");
    expect(source).not.toContain("pulseStudioAgentTransport");
    expect(source).not.toContain("buildPulseCreateAgentContext");
    expect(source).not.toContain("logic/contextBuilder");
    expect(source).toContain('Omit<UseAiAgentOptions, "runtimeMode">');
    expect(source).toContain('requestRuntimeMode: "standard"');
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
    expect(bridgeSource).toContain("./agentBridgeRuntime/pulseCreateAgentRuntimeBinding");
    expect(bridgeSource).toContain("./agentBridgeRuntime/standardCreateAgentRuntimeBinding");
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

    expect(pageSource).not.toContain("isCreatePulseBuiltInPresetId");
    expect(pageSource).not.toContain('from "../features/ai-studio/logic/pulseWorkflowSession"');
    expect(pageSource).toContain('import("../features/ai-studio/logic/pulseWorkflowSession")');
  });

  it("keeps the active Create composers mode-owned below the top-level switch", () => {
    const switchSource = readFrontendFile(
      "features/ai-studio/components/CreatePropertiesPanel.tsx"
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
    const pulsePromptStepSource = readFrontendFile(
      "features/ai-studio/components/PulsePromptStep.tsx"
    );

    expect(switchSource).toContain("StandardCreatePropertiesPanel");
    expect(switchSource).toContain("PulseCreatePropertiesPanel");
    expect(switchSource).toContain('resolvedExpertCreateMode === "pulse"');
    expect(switchSource).toContain('import("./create/PulseCreatePropertiesPanel")');
    expect(switchSource).not.toContain("PulseCreatePropertiesPanel,\n  type");

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

    expect(standardPromptStepSource).not.toContain("PulsePromptStepChatSurface");
    expect(standardPromptStepSource).not.toContain("pulseLoadingState");
    expect(standardPromptStepSource).not.toContain("useFlowComposerLayout");
    expect(pulsePromptStepSource).toContain("PulsePromptStepChatSurface");
  });

  it("keeps Pulse loading presentation out of the shared panel prop builder", () => {
    const panelPropBuilderSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioPanelProps.ts"
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
    expect(pulseComposerSource).toContain("PromptStepPulseLoadingState");
    expect(pulseComposerSource).toContain("resolveCreatePulsePresetLabelById");
    expect(pulseComposerSource).toContain("pulseLoadingState");
  });

  it("keeps shared generation submission from branching on Create mode", () => {
    const generationControllerSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioGenerationController.ts"
    );

    expect(generationControllerSource).not.toContain("expertCreateMode");
    expect(generationControllerSource).toContain("onAgentCaptureResult");
  });

  it("keeps Pulse workflow helpers out of shared orchestration static imports", () => {
    const orchestrationSource = readFrontendFile(
      "features/ai-studio/hooks/useAiStudioAgentOrchestration.ts"
    );

    expect(orchestrationSource).not.toContain("import { startPulsePreset");
    expect(orchestrationSource).not.toContain(
      "import { buildPendingPulseWorkflowSessionForUserInput"
    );
    expect(orchestrationSource).not.toContain('from "../logic/pulseImageIntake"');
    expect(orchestrationSource).not.toContain("../logic/pulseImageIntake");
    expect(orchestrationSource).not.toContain("../logic/pulseWorkflowSession");
    expect(orchestrationSource).toContain("./agentOrchestration/pulseSendRuntime");
    expect(orchestrationSource).toContain("./agentOrchestration/pulsePresetStart");
  });
});
