// File size budget checks for high-risk AI Studio/agent hotspots.
// Run with: node scripts/check_size_budgets.js
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();

const BUDGETS = [
  { file: "frontend/pages/ai-studio.tsx", maxLines: 1700 },
  { file: "frontend/features/ai-studio/hooks/useAiStudioState.ts", maxLines: 1400 },
  { file: "frontend/pages/api/ai/studio-agent.ts", maxLines: 1250 },
  { file: "frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts", maxLines: 650 },
  { file: "frontend/features/ai-studio/components/PromptStep.tsx", maxLines: 720 },
  { file: "frontend/features/ai-agent/useAiAgent.ts", maxLines: 360 },
];

function countLines(text) {
  if (!text.length) return 0;
  return text.split(/\r?\n/).length;
}

function run() {
  const errors = [];
  for (const budget of BUDGETS) {
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

  if (errors.length) {
    console.error("Size budget checks failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Size budget checks passed.");
}

run();
