// File size budget checks for high-risk AI Studio/agent hotspots.
// Run with: node scripts/check_size_budgets.js
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();

const ENFORCED_BUDGETS = [
  { file: "frontend/pages/ai-studio.tsx", maxLines: 1700 },
  { file: "frontend/features/ai-studio/hooks/useAiStudioState.ts", maxLines: 1400 },
  { file: "frontend/pages/api/ai/studio-agent.ts", maxLines: 1250 },
  { file: "frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts", maxLines: 650 },
  { file: "frontend/features/ai-studio/components/PromptStep.tsx", maxLines: 720 },
  { file: "frontend/features/ai-agent/useAiAgent.ts", maxLines: 360 },
];

const REFERENCE_GRID_TARGET_BUDGETS = [
  { file: "frontend/features/ai-studio/components/ReferenceGrid.tsx", maxLines: 900 },
  { file: "frontend/features/ai-studio/components/MediaLibraryModal.tsx", maxLines: 800 },
  { file: "frontend/features/ai-studio/hooks/useAiStudioState.ts", maxLines: 650 },
];

const EXPERT_EDIT_TARGET_BUDGETS = [
  { file: "frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx", maxLines: 5000 },
  { file: "frontend/features/ai-studio/components/edit/useInpaintMaskController.ts", maxLines: 1400 },
  { file: "frontend/features/ai-studio/components/MediaLibraryPanel.tsx", maxLines: 1600 },
];

const CHARACTER_MANAGER_TARGET_BUDGETS = [
  { file: "frontend/features/character-manager/components/CharacterManagerShell.tsx", maxLines: 2200 },
];

const MEDIA_RENDERING_TARGET_BUDGETS = [
  { file: "frontend/features/ai-studio/components/ReferenceGrid.tsx", maxLines: 1050 },
  { file: "frontend/features/ai-studio/components/MediaLibraryModal.tsx", maxLines: 700 },
  { file: "frontend/features/ai-studio/components/MediaLibraryPanel.tsx", maxLines: 1500 },
  { file: "frontend/features/ai-studio/logic/referenceGridMedia.ts", maxLines: 420 },
  { file: "frontend/features/media-library/components/MediaAssetGallery.tsx", maxLines: 320 },
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

function countLines(text) {
  if (!text.length) return 0;
  return text.split(/\r?\n/).length;
}

function resolveMode(inputMode, fallbackMode = "warn") {
  if (inputMode === "warn" || inputMode === "enforce") {
    return inputMode;
  }
  if (inputMode) {
    console.warn(`Unknown mode '${inputMode}'. Falling back to '${fallbackMode}'.`);
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
        `${budget.file} exceeds size budget (${lines} lines > ${budget.maxLines} lines).`
      );
    }
  }

  return errors;
}

function reportTargetBudgetGroup(modeEnvName, headerPrefix, budgets, hardErrors) {
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

  const referenceGridMode = resolveMode(process.env.REFERENCE_GRID_SIZE_BUDGET_MODE, "warn");
  const referenceGridErrors = collectBudgetErrors(REFERENCE_GRID_TARGET_BUDGETS);
  if (referenceGridErrors.length) {
    if (referenceGridMode === "enforce") {
      hardErrors.push(...referenceGridErrors);
      console.error("Reference-grid target size budget checks failed (enforce mode):");
      for (const error of referenceGridErrors) {
        console.error(`- ${error}`);
      }
    } else {
      console.warn("Reference-grid target size budget checks failed in warn mode:");
      for (const error of referenceGridErrors) {
        console.warn(`- ${error}`);
      }
    }
  }

  reportTargetBudgetGroup(
    "EXPERT_EDIT_SIZE_BUDGET_MODE",
    "Expert Edit target",
    EXPERT_EDIT_TARGET_BUDGETS,
    hardErrors
  );
  reportTargetBudgetGroup(
    "CHARACTER_MANAGER_SIZE_BUDGET_MODE",
    "Character Manager target",
    CHARACTER_MANAGER_TARGET_BUDGETS,
    hardErrors
  );
  reportTargetBudgetGroup(
    "MEDIA_RENDERING_SIZE_BUDGET_MODE",
    "Media Rendering target",
    MEDIA_RENDERING_TARGET_BUDGETS,
    hardErrors
  );
  reportTargetBudgetGroup(
    "ADMIN_HEALTH_SIZE_BUDGET_MODE",
    "Admin/Health target",
    ADMIN_HEALTH_TARGET_BUDGETS,
    hardErrors
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
