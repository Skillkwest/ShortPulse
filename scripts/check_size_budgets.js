// File size budget checks for high-risk AI Studio/agent hotspots.
// Run with: node scripts/check_size_budgets.js
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();

const ENFORCED_BUDGETS = [
  { file: "frontend/pages/ai-studio.tsx", maxLines: 1700 },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioState.ts",
    maxLines: 1400,
  },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts",
    maxLines: 650,
  },
  {
    file: "frontend/features/ai-studio/components/PromptStep.tsx",
    maxLines: 720,
  },
  {
    file: "frontend/features/ai-agent/useCreateAgentStateCore.ts",
    maxLines: 500,
  },
];

const REFERENCE_GRID_TARGET_BUDGETS = [
  {
    file: "frontend/features/ai-studio/components/ReferenceGrid.tsx",
    maxLines: 900,
  },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioState.ts",
    maxLines: 950,
  },
];

const EXPERT_EDIT_TARGET_BUDGETS = [
  {
    file: "frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx",
    maxLines: 1800,
  },
  {
    file: "frontend/features/ai-studio/components/edit/useInpaintMaskController.ts",
    maxLines: 1250,
  },
  {
    file: "frontend/features/ai-studio/components/MediaLibraryPanel.tsx",
    maxLines: 1550,
  },
];

const AI_STUDIO_RUNTIME_TARGET_BUDGETS = [
  { file: "frontend/pages/ai-studio.tsx", maxLines: 3000 },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts",
    maxLines: 1000,
  },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioStateRuntimeControllers.ts",
    maxLines: 450,
  },
];

const CHARACTER_MANAGER_TARGET_BUDGETS = [
  {
    file: "frontend/features/character-manager/components/CharacterPanelWorkspace.tsx",
    maxLines: 2200,
  },
];

const MEDIA_RENDERING_TARGET_BUDGETS = [
  {
    file: "frontend/features/ai-studio/components/ReferenceGrid.tsx",
    maxLines: 1050,
  },
  {
    file: "frontend/features/ai-studio/components/MediaLibraryPanel.tsx",
    maxLines: 1500,
  },
  {
    file: "frontend/features/ai-studio/logic/referenceGridMedia.ts",
    maxLines: 420,
  },
  {
    file: "frontend/features/media-library/hooks/useMediaPreviewSigningController.ts",
    maxLines: 400,
  },
  { file: "frontend/lib/adaptive-media/resolver.ts", maxLines: 320 },
  { file: "frontend/lib/mediaPreviewPath.ts", maxLines: 280 },
];

const ADMIN_HEALTH_TARGET_BUDGETS = [
  { file: "frontend/pages/admin/index.tsx", maxLines: 1300 },
  { file: "frontend/pages/api/admin/user-health.ts", maxLines: 900 },
  { file: "frontend/lib/server/adminUserHealth/fleet.ts", maxLines: 900 },
];

// Ratchet ceilings for the largest current launch surfaces that are not ready
// for a broad split during the July 7 hardening window. These caps preserve
// today's shape while warning if the files grow further.
const LAUNCH_SOURCE_INVENTORY_BUDGETS = [
  {
    file: "frontend/features/admin/components/AdminAgentInstructionsSection.tsx",
    maxLines: 2591,
  },
  {
    file: "frontend/features/ai-studio/logic/generatedMediaAuthority.ts",
    maxLines: 2418,
  },
  {
    file: "frontend/features/ai-studio/components/VideoPropertiesPanel.tsx",
    maxLines: 2119,
  },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts",
    maxLines: 1993,
  },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts",
    maxLines: 1978,
  },
  {
    file: "frontend/features/ai-studio/components/AiStudioPageContent.tsx",
    maxLines: 1969,
  },
  {
    file: "frontend/lib/server/mediaUploadService.ts",
    maxLines: 1915,
  },
  {
    file: "frontend/lib/server/mediaCopyFromUrlService.ts",
    maxLines: 1859,
  },
  {
    file: "frontend/features/ai-studio/logic/mediaLibraryPersistence.ts",
    maxLines: 1793,
  },
  {
    file: "frontend/lib/model-runtime/modelCatalog.ts",
    maxLines: 1786,
  },
  {
    file: "frontend/lib/server/projectWorkspaceStatesService.ts",
    maxLines: 1749,
  },
  {
    file: "frontend/features/ai-studio/components/useReferencePropertiesInteractions.ts",
    maxLines: 1707,
  },
  {
    file: "frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx",
    maxLines: 1687,
  },
  {
    file: "frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts",
    maxLines: 1622,
  },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioTasks.ts",
    maxLines: 1579,
  },
  {
    file: "frontend/lib/server/projectGenerationAssociationsService.ts",
    maxLines: 1570,
  },
  {
    file: "frontend/features/elements-manager/components/ElementsManagerShell.tsx",
    maxLines: 1556,
  },
  {
    file: "frontend/features/character-manager/logic/characterManagerPersistence.ts",
    maxLines: 1554,
  },
  {
    file: "frontend/lib/server/falIntegration/recoveryExecution.ts",
    maxLines: 1551,
  },
  {
    file: "frontend/features/ai-studio/components/DetailModal.tsx",
    maxLines: 1523,
  },
  {
    file: "frontend/lib/server/api/adminBillingDiagnostics.ts",
    maxLines: 1511,
  },
];

const LAUNCH_STYLE_INVENTORY_BUDGETS = [
  { file: "frontend/styles/ai-studio-edit-expert.css", maxLines: 6255 },
  { file: "frontend/styles/admin.module.css", maxLines: 5077 },
  {
    file: "frontend/styles/ai-studio-voices-properties.module.css",
    maxLines: 4382,
  },
  { file: "frontend/styles/workspace-dashboard.css", maxLines: 3928 },
  { file: "frontend/styles/ai-studio-layout.css", maxLines: 2803 },
  { file: "frontend/styles/ai-studio-video-theme.css", maxLines: 2624 },
  { file: "frontend/styles/character-manager.css", maxLines: 2227 },
  { file: "frontend/styles/workspace-media.css", maxLines: 1799 },
  { file: "frontend/styles/ai-studio-modals.css", maxLines: 1731 },
];

function countLines(text) {
  if (!text.length) return 0;
  return text.split(/\r?\n/).length;
}

function resolveMode(inputMode, fallbackMode = "warn") {
  if (inputMode === "warn" || inputMode === "enforce") {
    return inputMode;
  }
  if (inputMode) {
    console.warn(
      `Unknown mode '${inputMode}'. Falling back to '${fallbackMode}'.`,
    );
  }
  return fallbackMode;
}

function collectBudgetErrors(budgets) {
  const errors = [];
  for (const budget of budgets) {
    const fullPath = path.join(REPO_ROOT, budget.file);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Missing budgeted file: ${budget.file}`);
      continue;
    }
    const text = fs.readFileSync(fullPath, "utf8");
    const lines = countLines(text);
    if (lines > budget.maxLines) {
      errors.push(
        `${budget.file} exceeds size budget (${lines} lines > ${budget.maxLines} lines).`,
      );
    }
  }

  return errors;
}

function reportTargetBudgetGroup(
  modeEnvName,
  headerPrefix,
  budgets,
  hardErrors,
) {
  const mode = resolveMode(process.env[modeEnvName], "warn");
  const errors = collectBudgetErrors(budgets);
  if (!errors.length) return;
  if (mode === "enforce") {
    console.error(`${headerPrefix} size budget checks failed (enforce mode):`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    hardErrors.push(...errors);
    return;
  }
  console.warn(`${headerPrefix} size budget checks failed in warn mode:`);
  for (const error of errors) {
    console.warn(`- ${error}`);
  }
}

function run() {
  const hardErrors = [];
  const enforcedErrors = collectBudgetErrors(ENFORCED_BUDGETS);
  if (enforcedErrors.length) {
    hardErrors.push(...enforcedErrors);
  }

  const referenceGridMode = resolveMode(
    process.env.REFERENCE_GRID_SIZE_BUDGET_MODE,
    "warn",
  );
  const referenceGridErrors = collectBudgetErrors(
    REFERENCE_GRID_TARGET_BUDGETS,
  );
  if (referenceGridErrors.length) {
    if (referenceGridMode === "enforce") {
      hardErrors.push(...referenceGridErrors);
      console.error(
        "Reference-grid target size budget checks failed (enforce mode):",
      );
      for (const error of referenceGridErrors) {
        console.error(`- ${error}`);
      }
    } else {
      console.warn(
        "Reference-grid target size budget checks failed in warn mode:",
      );
      for (const error of referenceGridErrors) {
        console.warn(`- ${error}`);
      }
    }
  }

  reportTargetBudgetGroup(
    "AI_STUDIO_RUNTIME_SIZE_BUDGET_MODE",
    "AI Studio runtime target",
    AI_STUDIO_RUNTIME_TARGET_BUDGETS,
    hardErrors,
  );
  reportTargetBudgetGroup(
    "EXPERT_EDIT_SIZE_BUDGET_MODE",
    "Expert Edit target",
    EXPERT_EDIT_TARGET_BUDGETS,
    hardErrors,
  );
  reportTargetBudgetGroup(
    "CHARACTER_MANAGER_SIZE_BUDGET_MODE",
    "Character Manager target",
    CHARACTER_MANAGER_TARGET_BUDGETS,
    hardErrors,
  );
  reportTargetBudgetGroup(
    "MEDIA_RENDERING_SIZE_BUDGET_MODE",
    "Media Rendering target",
    MEDIA_RENDERING_TARGET_BUDGETS,
    hardErrors,
  );
  reportTargetBudgetGroup(
    "ADMIN_HEALTH_SIZE_BUDGET_MODE",
    "Admin/Health target",
    ADMIN_HEALTH_TARGET_BUDGETS,
    hardErrors,
  );
  reportTargetBudgetGroup(
    "LAUNCH_SOURCE_INVENTORY_SIZE_BUDGET_MODE",
    "Launch source inventory",
    LAUNCH_SOURCE_INVENTORY_BUDGETS,
    hardErrors,
  );
  reportTargetBudgetGroup(
    "LAUNCH_STYLE_INVENTORY_SIZE_BUDGET_MODE",
    "Launch style inventory",
    LAUNCH_STYLE_INVENTORY_BUDGETS,
    hardErrors,
  );

  if (hardErrors.length) {
    console.error("Size budget checks failed:");
    for (const error of hardErrors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Size budget checks passed.");
}

run();
