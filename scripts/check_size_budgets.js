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
  { file: "frontend/features/ai-studio/components/ReferenceCanvas.tsx", maxLines: 900 },
  { file: "frontend/features/ai-studio/components/MediaLibraryModal.tsx", maxLines: 800 },
  { file: "frontend/features/ai-studio/hooks/useAiStudioState.ts", maxLines: 650 },
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

function run() {
  const enforcedErrors = collectBudgetErrors(ENFORCED_BUDGETS);
  if (enforcedErrors.length) {
    console.error("Size budget checks failed:");
    for (const error of enforcedErrors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const referenceGridMode = resolveMode(process.env.REFERENCE_GRID_SIZE_BUDGET_MODE, "warn");
  const referenceGridErrors = collectBudgetErrors(REFERENCE_GRID_TARGET_BUDGETS);
  if (referenceGridErrors.length) {
    if (referenceGridMode === "enforce") {
      console.error("Reference-grid target size budget checks failed (enforce mode):");
      for (const error of referenceGridErrors) {
        console.error(`- ${error}`);
      }
      process.exit(1);
    }
    console.warn("Reference-grid target size budget checks failed in warn mode:");
    for (const error of referenceGridErrors) {
      console.warn(`- ${error}`);
    }
  }

  console.log("Size budget checks passed.");
}

run();
